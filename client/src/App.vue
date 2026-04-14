<script setup>
import BaseNavbar from './components/BaseNavbar.vue'
import BaseHero from './components/BaseHero.vue'
</script>

<template>
  <BaseHero />
  <RouterView />
  <BaseNavbar />
</template>
