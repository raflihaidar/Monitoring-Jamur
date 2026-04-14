<template>
  <div class="flex min-h-screen bg-[#f5f7fb] p-4 gap-4">
    <aside class="w-64 bg-white rounded-2xl p-5 shadow-sm">
      <h2 class="font-semibold mb-4">WongPonik</h2>

      <!-- Menu -->
      <ul class="space-y-3 text-sm">
        <li>
          <RouterLink
            to="/"
            class="block rounded-xl px-3 py-2"
            :class="$route.name === 'home'
              ? 'bg-gray-100 font-medium text-green-500'
              : 'text-gray-400'"
          >
            Dashboard
          </RouterLink>
        </li>

        <li>
          <RouterLink
            to="/history"
            class="block rounded-xl px-3 py-2"
            :class="$route.name === 'history'
              ? 'bg-gray-100 font-medium text-green-500'
              : 'text-gray-400'"
          >
            History
          </RouterLink>
        </li>
      </ul>
    </aside>

    <slot />
  </div>
</template>