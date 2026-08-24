<script setup lang="ts">
import { onMounted } from "vue";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import AppPicker from "./components/AppPicker.vue";
import GadgetPanel from "./components/GadgetPanel.vue";
import TargetCard from "./components/TargetCard.vue";
import { useFrida } from "./composables/useFrida";

const {
  tab,
  config,
  expanded,
  appFilter,
  fetchingApps,
  pickerOpen,
  pickerQuery,
  filteredApps,
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
  <div class="shell">
    <header class="mast">
      <div>
        <div class="wordmark">Ksu<span>Frida</span></div>
        <p class="lede">Gadget injection</p>
      </div>
      <button
        class="chip"
        :class="gadgetInstalled ? 'live' : 'missing'"
        type="button"
        @click="tab = 'gadget'"
      >
        {{ gadgetInstalled ? "Live" : "Missing" }}
      </button>
    </header>

    <TabsRoot v-model="tab" class="stage-tabs">
    <TabsList class="tabs">
      <TabsTrigger class="tab-trigger" value="targets">Targets</TabsTrigger>
      <TabsTrigger class="tab-trigger" value="gadget">Gadget</TabsTrigger>
    </TabsList>

    <main class="stage">
      <TabsContent value="targets" class="deck">
        <div class="row">
          <span class="lede" style="margin:0">{{ config.targets.length }} hooked</span>
          <button class="solid" type="button" @click="openPicker">Add app</button>
        </div>

        <div v-if="!config.targets.length" class="empty">
          <strong>No probes yet</strong>
          Add an app, then install a gadget on the other tab.
        </div>

        <TargetCard
          v-for="(target, index) in config.targets"
          :key="target.app_name"
          :target="target"
          :label="labelOf(target.app_name)"
          :open="Boolean(expanded[target.app_name])"
          @toggle="toggleExpand(target.app_name)"
          @remove="removeTarget(index)"
        />
      </TabsContent>

      <TabsContent value="gadget">
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
    </main>
    </TabsRoot>

    <footer class="dock">
      <button class="ghost" type="button" :disabled="busy" @click="reload">Reload</button>
      <button class="solid" type="button" :disabled="busy" @click="saveAll">Save</button>
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
