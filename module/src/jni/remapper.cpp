#include "remapper.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>

#include <cinttypes>
#include <string>
#include <vector>

#include "log.h"

struct MapEntry {
    uintptr_t start;
    uintptr_t end;
    int perms;
    std::string path;
};

static std::string basename_of(std::string path) {
    auto deleted = path.find(" (deleted)");
    if (deleted != std::string::npos) {
        path.erase(deleted);
    }
    auto slash = path.find_last_of("/\\");
    if (slash == std::string::npos) {
        return path;
    }
    return path.substr(slash + 1);
}

static bool is_file_backed(const std::string &path) {
    return !path.empty() && path[0] != '[';
}

static std::vector<MapEntry> get_modules_by_name(const std::string &lib_name) {
    std::vector<MapEntry> maps;
    FILE *fp = fopen("/proc/self/maps", "re");
    if (fp == nullptr) {
        return maps;
    }

    char buffer[1024];
    while (fgets(buffer, sizeof(buffer), fp)) {
        uintptr_t start = 0;
        uintptr_t end = 0;
        uintptr_t offset = 0;
        char perms[8] = {};
        char dev[32] = {};
        char path[512] = {};

        int n = sscanf(
            buffer,
            "%" SCNxPTR "-%" SCNxPTR " %7s %" SCNxPTR " %31s %*s %511[^\n]",
            &start, &end, perms, &offset, dev, path);
        if (n < 5) {
            continue;
        }

        std::string maps_path = (n >= 6) ? path : "";
        while (!maps_path.empty() && (maps_path.front() == ' ' || maps_path.front() == '\t')) {
            maps_path.erase(maps_path.begin());
        }
        if (!is_file_backed(maps_path)) {
            continue;
        }
        if (basename_of(maps_path) != lib_name) {
            continue;
        }

        MapEntry info{};
        info.start = start;
        info.end = end;
        info.perms = 0;
        if (strchr(perms, 'r')) info.perms |= PROT_READ;
        if (strchr(perms, 'w')) info.perms |= PROT_WRITE;
        if (strchr(perms, 'x')) info.perms |= PROT_EXEC;
        info.path = maps_path;
        maps.push_back(info);
    }

    fclose(fp);
    return maps;
}

void remap_lib(std::string lib_path) {
    std::string lib_name = basename_of(lib_path);
    if (lib_name.empty()) {
        return;
    }

    std::vector<MapEntry> maps = get_modules_by_name(lib_name);
    if (maps.empty()) {
        return;
    }

    LOGI("Remapping %s (%zu segments)", lib_name.c_str(), maps.size());

    for (const MapEntry &info : maps) {
        void *address = reinterpret_cast<void *>(info.start);
        size_t size = info.end - info.start;
        if (size == 0) {
            continue;
        }

        void *copy = mmap(nullptr, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        if (copy == MAP_FAILED) {
            LOGE("Failed to allocate remap buffer: %s", strerror(errno));
            continue;
        }

        int readable = info.perms | PROT_READ;
        if ((info.perms & PROT_READ) == 0) {
            if (mprotect(address, size, readable) != 0) {
                LOGE("Failed to make %s readable: %s", info.path.c_str(), strerror(errno));
                munmap(copy, size);
                continue;
            }
        }

        memcpy(copy, address, size);

        void *remapped = mremap(copy, size, size, MREMAP_MAYMOVE | MREMAP_FIXED, address);
        if (remapped == MAP_FAILED) {
            LOGE("mremap failed for %s: %s", info.path.c_str(), strerror(errno));
            munmap(copy, size);
            mprotect(address, size, info.perms);
            continue;
        }

        if (mprotect(address, size, info.perms) != 0) {
            LOGW("Failed to restore prot on remapped %s: %s", info.path.c_str(), strerror(errno));
        }
    }

    LOGI("Remapped %s", lib_name.c_str());
}
