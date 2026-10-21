<script setup lang="ts">
// 用到這一項的地方（其他內容與目前的存檔）；自建項目要都拿掉之後才能刪
defineProps<{ usage: string[]; deletable: boolean }>()
</script>

<template>
  <details v-if="usage.length" class="usage small">
    <summary>🔗 有 {{ usage.length }} 個地方用到{{ deletable ? '（都拿掉之後才能刪除）' : '' }}</summary>
    <ul>
      <li v-for="u in usage" :key="u">{{ u }}</li>
    </ul>
  </details>
</template>

<style scoped>
.usage { border: 1px dashed var(--border); border-radius: var(--radius); padding: 4px 8px; }
.usage summary { cursor: pointer; color: var(--accent-2); }
.usage ul { margin: 4px 0 0; padding-left: 18px; }
</style>
