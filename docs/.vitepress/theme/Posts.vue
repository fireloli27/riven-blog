<script setup lang="ts">
import { withBase } from 'vitepress'
import { data as posts } from './posts.data'
</script>

<template>
  <p v-if="posts.length === 0" class="empty">还没有文章。</p>
  <ul v-else class="post-list">
    <li v-for="post in posts" :key="post.url" class="post">
      <a class="title" :href="withBase(post.url)">{{ post.title }}</a>
      <p class="meta">
        <time v-if="post.date" :datetime="post.date">{{ post.date }}</time>
        <span v-for="tag in post.tags" :key="tag" class="tag">{{ tag }}</span>
      </p>
    </li>
  </ul>
</template>

<style scoped>
.post-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.post {
  padding: 1rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.title:hover {
  color: var(--vp-c-brand-1);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin: 0.4rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.tag::before {
  content: '#';
}

.empty {
  color: var(--vp-c-text-2);
}
</style>
