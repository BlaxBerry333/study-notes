<template>
  <div class="STUDY-NOTES--grid-background" />
</template>

<style scoped>
/* Background grid effect - Full page with 3D perspective */
.STUDY-NOTES--grid-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 200%;
  background-image:
    linear-gradient(rgba(0, 255, 159, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 159, 0.03) 1px, transparent 1px);
  background-size: 30px 30px;
  transform: perspective(500px) rotateX(60deg);
  transform-origin: center top;
  pointer-events: none;
  z-index: 0;
}
</style>
