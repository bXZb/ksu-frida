<script setup lang="ts">
import { computed, ref } from "vue";
import { FolderSearch, HardDriveDownload, Trash2 } from "@lucide/vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const props = defineProps<{
  installed: boolean;
  detail: string;
  json: string;
  jsonStatus: "ok" | "missing" | "invalid";
  jsonError: string | null;
  path: string;
  scan: string[];
  scanning: boolean;
  installing: boolean;
  clearLibs: boolean;
}>();

const emit = defineEmits<{
  "update:json": [string];
  "update:path": [string];
  "update:clearLibs": [boolean];
  format: [];
  scan: [];
  install: [];
  remove: [];
  pick: [string];
}>();

const replaceOpen = ref(false);

const jsonValid = computed(() => props.jsonError === null);
</script>

<template>
  <div class="flex flex-col gap-3">
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between gap-3">
          <CardTitle>Gadget binary</CardTitle>
          <Badge :variant="installed ? 'default' : 'secondary'">
            <span
              class="size-1.5 rounded-full"
              :class="installed ? 'bg-live animate-pulse' : 'bg-warn'"
            />
            {{ installed ? "Installed" : "Missing" }}
          </Badge>
        </div>
        <CardDescription>
          Gadget is not bundled. Copy a Frida gadget
          <span class="font-mono text-xs">.so</span> onto the device, then install it as
          <span class="font-mono text-xs">libsecmon.so</span>.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-muted-foreground font-mono text-xs break-all">{{ detail }}</p>

        <div class="space-y-1.5">
          <label class="text-[11px] tracking-[0.12em] uppercase text-muted-foreground">
            Install from path
          </label>
          <Input
            :model-value="path"
            placeholder="/sdcard/Download/frida-gadget-android-arm64.so"
            spellcheck="false"
            @update:model-value="emit('update:path', String($event))"
          />
        </div>

        <div v-if="scan.length" class="max-h-44 overflow-y-auto rounded-lg border">
          <button
            v-for="item in scan"
            :key="item"
            type="button"
            class="hover:bg-accent/60 block w-full cursor-pointer border-b px-3 py-2 text-left font-mono text-xs break-all transition-colors last:border-0"
            @click="emit('pick', item)"
          >
            {{ item }}
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" :disabled="scanning" @click="emit('scan')">
            <FolderSearch class="size-4" />
            {{ scanning ? "Scanning…" : "Scan" }}
          </Button>

          <AlertDialog v-if="installed" v-model:open="replaceOpen">
            <AlertDialogTrigger as-child>
              <Button size="sm" :disabled="installing">
                <HardDriveDownload class="size-4" />
                {{ installing ? "Installing…" : "Replace" }}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace gadget?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current <span class="font-mono text-xs">libsecmon.so</span> will be
                  overwritten. Running apps are not affected until relaunch.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction @click="emit('install')">Replace</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button v-else size="sm" :disabled="installing" @click="emit('install')">
            <HardDriveDownload class="size-4" />
            {{ installing ? "Installing…" : "Install" }}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive">
                <Trash2 class="size-4" />
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove gadget?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deletes <span class="font-mono text-xs">libsecmon.so</span>. Targets keep
                  their config but injection will not load.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  class="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
                  @click="emit('remove')"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <label class="text-muted-foreground flex cursor-pointer items-center gap-2.5 text-sm">
          <Switch
            :model-value="clearLibs"
            @update:model-value="emit('update:clearLibs', $event)"
          />
          Also clear injected libraries on all targets
        </label>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between gap-3">
          <CardTitle>Listen config</CardTitle>
          <Badge
            :variant="jsonStatus === 'ok' ? 'default' : jsonStatus === 'invalid' ? 'destructive' : 'secondary'"
          >
            {{ jsonStatus === "ok" ? "Valid JSON" : jsonStatus === "invalid" ? "Invalid" : "Not found" }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-2">
        <Textarea
          class="min-h-56 font-mono text-xs"
          spellcheck="false"
          :model-value="json"
          @update:model-value="emit('update:json', String($event))"
        />
        <p v-if="!jsonValid" class="text-destructive font-mono text-xs">
          {{ jsonError }}
        </p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" :disabled="!jsonValid" @click="emit('format')">
            Format
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
