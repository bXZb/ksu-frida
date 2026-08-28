<script setup lang="ts">
import { onMounted } from "vue";
import AppPicker from "./components/AppPicker.vue";
import GadgetPanel from "./components/GadgetPanel.vue";
import TargetCard from "./components/TargetCard.vue";
import { useFrida } from "./composables/useFrida";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const {
  tab,
  config,
  expanded,
  appFilter,
  fetchingApps,
  pickerOpen,
  pickerQuery,
  filteredApps,
  dirty,
  targetFilter,
  filteredTargets,
  gadgetInstalled,
  gadgetDetail,
  gadgetJson,
  gadgetJsonStatus,
  gadgetPath,
  gadgetScan,
  scanning,
  installing,
  clearLibsOnGadgetChange,
  busy,
  labelOf,
  saveAll,
  reload,
  boot,
  installGadget,
  removeGadget,
  scanGadgetCandidates,
  setAppFilter,
  openPicker,
  addTarget,
  removeTarget,
  toggleExpand,
} = useFrida();

onMounted(() => {
  void boot();
});
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full min-w-0 max-w-xl flex-col px-4 pt-[calc(0.875rem+var(--safe-top))] pb-[calc(0.75rem+var(--safe-bottom))]"
  >
    <header class="flex min-w-0 items-end justify-between gap-3 border-b pb-4">
      <div class="min-w-0">
        <h1 class="truncate text-[22px] leading-tight font-bold tracking-tight">
          Ksu<span class="text-primary">Frida</span>
        </h1>
        <p class="mt-1 text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
          Gadget injection
        </p>
      </div>
      <button
        type="button"
        class="hover:bg-accent inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5 font-mono text-[11px] transition-colors"
        @click="tab = 'gadget'"
      >
        <span
          class="size-1.5 rounded-full"
          :class="gadgetInstalled ? 'bg-live animate-pulse' : 'bg-warn'"
        />
        {{ gadgetInstalled ? "Live" : "Missing" }}
      </button>
    </header>

    <Tabs v-model="tab" class="mt-3 flex min-h-0 flex-1 flex-col">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="targets">Targets</TabsTrigger>
        <TabsTrigger value="gadget">Gadget</TabsTrigger>
      </TabsList>

      <TabsContent value="targets" class="mt-3 flex flex-1 flex-col gap-2.5">
        <div class="flex items-center justify-between gap-3">
          <span class="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            {{ config.targets.length }} hooked
          </span>
          <Button size="sm" @click="openPicker">+ Add app</Button>
        </div>

        <div v-if="config.targets.length" class="flex items-center gap-1.5">
          <button
            v-for="f in (['all', 'enabled', 'disabled'] as const)"
            :key="f"
            type="button"
            class="cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors"
            :class="
              targetFilter === f
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="targetFilter = f"
          >
            {{ f }}
          </button>
        </div>

        <div
          v-if="!config.targets.length"
          class="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm"
        >
          <p class="text-foreground mb-1 font-semibold">No probes yet</p>
          Add an app, then install a gadget on the other tab.
        </div>

        <TargetCard
          v-for="target in filteredTargets"
          :key="target.app_name"
          :target="target"
          :label="labelOf(target.app_name)"
          :open="Boolean(expanded[target.app_name])"
          @toggle="toggleExpand(target.app_name)"
          @remove="removeTarget"
        />
      </TabsContent>

      <TabsContent value="gadget" class="mt-3">
        <GadgetPanel
          :installed="gadgetInstalled"
          :detail="gadgetDetail"
          :json="gadgetJson"
          :json-status="gadgetJsonStatus"
          :path="gadgetPath"
          :scan="gadgetScan"
          :scanning="scanning"
          :installing="installing"
          :clear-libs="clearLibsOnGadgetChange"
          @update:json="gadgetJson = $event"
          @update:path="gadgetPath = $event"
          @update:clear-libs="clearLibsOnGadgetChange = $event"
          @scan="scanGadgetCandidates"
          @install="installGadget"
          @remove="removeGadget"
          @pick="gadgetPath = $event"
        />
      </TabsContent>
    </Tabs>

    <footer
      class="sticky bottom-0 -mx-4 mt-3 flex gap-2 border-t bg-background/80 px-4 pt-3 pb-1 backdrop-blur-md"
    >
      <Button class="flex-1" variant="outline" :disabled="busy" @click="reload">Reload</Button>
      <Button class="relative flex-1" :disabled="busy" @click="saveAll">
        Save
        <span
          v-if="dirty"
          class="bg-foreground ring-background absolute top-1 right-2 size-1.5 rounded-full ring-2"
          aria-label="Unsaved changes"
        />
      </Button>
    </footer>
  </div>

  <AppPicker
    :open="pickerOpen"
    :query="pickerQuery"
    :filter="appFilter"
    :apps="filteredApps"
    :loading="fetchingApps"
    :label-of="labelOf"
    @update:open="pickerOpen = $event"
    @update:query="pickerQuery = $event"
    @update:filter="setAppFilter"
    @pick="addTarget"
  />
</template>
