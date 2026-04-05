# ファイルアップロード

## 問題

GraphQL のリクエストとレスポンスは全て JSON であり、JSON はバイナリファイルを格納できない。そのため GraphQL 自体にはファイルアップロード機能がなく、JSON の層をバイパスして実現する必要がある

よくある方法は 3 つあり、核心的な違いは**ファイルが GraphQL サーバーを経由するかどうか**である：

```txt
方式 1：署名付き URL（ファイルは GraphQL を経由しない）
  Client ──▶ GraphQL: "アップロード認証情報をくれ"
  Client ──▶ S3/OSS: ファイルを直接アップロード      ← ファイルをクラウドストレージに直送
  Client ──▶ GraphQL: "ファイルのアップロードが完了した、記録してくれ"

方式 2：graphql-upload（ファイルが GraphQL を経由する）
  Client ──▶ GraphQL: ファイル + リクエストを一緒に送信   ← ファイルがまず GraphQL サーバーに届く

方式 3：混合（ファイルは REST、メタデータは GraphQL）
  Client ──▶ REST: ファイルをアップロード
  Client ──▶ GraphQL: メタデータを保存
```

| 方式 | ファイルが GraphQL を経由 | 適用シーン |
| --- | --- | --- |
| 署名付き URL | 経由しない | 新規プロジェクト、クラウドストレージあり、大きなファイル |
| graphql-upload | 経由する | 小さなファイル（アバター、アイコン）、フローをシンプルにしたい場合 |
| 混合方式 | 経由しない | 既存の REST アップロードサービスがある場合 |

---

## 方式 1：署名付き URL

> 推奨方式

考え方：GraphQL は**アップロード認証情報の生成**と**ファイル記録の保存**のみを担当し、ファイル自体はクライアントがクラウドストレージ（S3/OSS/GCS）に直接アップロードする。GraphQL サーバーを経由しない

3 ステップに分かれる：

```txt
ステップ                      何をするか                       誰が処理
─────────────────────────────────────────────────────────────────────
① getUploadUrl Mutation     署名付き URL とファイル識別子を取得 GraphQL
② PUT ファイル              クライアントが署名付き URL で直接クラウドストレージにアップロード クライアント → S3
③ saveFile Mutation         GraphQL に "ファイルアップロード完了" を通知 GraphQL
```

---

### サーバー側

```graphql
type Mutation {
  getUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!
  saveFile(input: SaveFileInput!): File!
}

input GetUploadUrlInput {
  fileName: String!
  contentType: String!
}

type UploadUrlPayload {
  uploadUrl: String!     # 署名付き URL、クライアントはこれでファイルを直接アップロード
  fileKey: String!       # クラウドストレージ内のファイルパス識別子
}

input SaveFileInput {
  fileKey: String!
  fileName: String!
  contentType: String!
  size: Int!
}
```

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "ap-northeast-1" });

const resolvers = {
  Mutation: {
    // ① 署名付き URL を生成
    getUploadUrl: async (_, { input }) => {
      const fileKey = `uploads/${Date.now()}-${input.fileName}`;
      const command = new PutObjectCommand({
        Bucket: "my-bucket",
        Key: fileKey,
        ContentType: input.contentType,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
      return { uploadUrl, fileKey };
    },

    // ③ ファイル記録を保存
    saveFile: async (_, { input }, { db }) => {
      return db.files.create({
        ...input,
        url: `https://my-bucket.s3.amazonaws.com/${input.fileKey}`,
      });
    },
  },
};
```

---

### クライアント側

```ts
// ① アップロード認証情報を取得
const { data } = await client.mutate({
  mutation: GET_UPLOAD_URL,
  variables: { input: { fileName: "photo.jpg", contentType: "image/jpeg" } },
});

// ② S3 に直接アップロード（GraphQL サーバーを経由しない）
await fetch(data.getUploadUrl.uploadUrl, {
  method: "PUT",
  body: file, // HTMLInputElement.files[0]
  headers: { "Content-Type": "image/jpeg" },
});

// ③ GraphQL にファイルアップロード完了を通知
await client.mutate({
  mutation: SAVE_FILE,
  variables: {
    input: {
      fileKey: data.getUploadUrl.fileKey,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: file.size,
    },
  },
});
```

---

## 方式 2：graphql-upload

ファイルを multipart/form-data で GraphQL エンドポイントに直接送信し、1 回のリクエストで完了する。小さなファイルのシーンに適している

```zsh
% npm install graphql-upload
```

::: warning Apollo Server 4 の互換性

Apollo Server 4 は組み込みのファイルアップロードサポートを削除した。Express ミドルウェア（`graphqlUploadExpress`）の追加設定が必要で、`startStandaloneServer` を直接使うことはできない
:::

---

### サーバー側

```graphql
scalar Upload

type Mutation {
  uploadFile(file: Upload!): File!
}
```

```ts
import { GraphQLUpload } from "graphql-upload";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const resolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    uploadFile: async (_, { file }) => {
      const { createReadStream, filename, mimetype } = await file;
      const path = `./uploads/${Date.now()}-${filename}`;

      await pipeline(createReadStream(), createWriteStream(path));

      return {
        id: "generated-id",
        url: path,
        fileName: filename,
        contentType: mimetype,
        size: 0,
      };
    },
  },
};
```

---

### クライアント側

デフォルトの HTTP Link を `apollo-upload-client` で置き換える必要がある：

```ts
import { createUploadLink } from "apollo-upload-client";

// デフォルトの httpLink を置き換える（両者は同時に使用できない）
const client = new ApolloClient({
  link: createUploadLink({ uri: "http://localhost:4000/graphql" }),
  cache: new InMemoryCache(),
});

// File オブジェクトをそのまま変数として渡す
await client.mutate({
  mutation: gql`
    mutation UploadFile($file: Upload!) {
      uploadFile(file: $file) { id url fileName }
    }
  `,
  variables: { file: selectedFile }, // HTMLInputElement.files[0]
});
```

::: danger 大きなファイルのリスク

ファイル全体が GraphQL サーバーのメモリにロードされる。100MB のファイルをアップロード = サーバーメモリが 100MB 余分に消費される。本番環境で大きなファイルをアップロードする場合は署名付き URL 方式を使うべきである
:::

---

## 方式 3：混合方式

ファイルアップロードは既存の REST エンドポイントを使い、GraphQL はメタデータのみを処理する。既に REST のファイルアップロードサービスがあり、改修したくない場合に適している

```ts
// 1. REST でファイルをアップロード
const formData = new FormData();
formData.append("file", selectedFile);
const res = await fetch("/api/upload", { method: "POST", body: formData });
const { fileUrl } = await res.json();

// 2. GraphQL でメタデータを保存
await client.mutate({
  mutation: CREATE_POST,
  variables: {
    input: {
      title: "My Post",
      content: "...",
      coverImage: fileUrl, // ファイル URL を通常の文字列として渡す
    },
  },
});
```
