#include "config.h"

#include <fstream>
#include <optional>
#include <string>
#include <vector>

#include "rapidjson/document.h"
#include "rapidjson/istreamwrapper.h"
#include "rapidjson/error/en.h"
#include "log.h"

// This must work in a non-exception environment as the libcxx we use don't have support for exception.
// Should avoid any libraries aborting on parse error as this will run on every app start and
// might otherwise cause issues for any app starting if misconfigured.

static std::optional<std::vector<std::string>> deserialize_libraries(const rapidjson::Value &doc) {
    if (!doc.IsArray()) {
        LOGE("invalid config: expected injected_libraries to be an array");
        return std::nullopt;
    }

    std::vector<std::string> result;

    for (rapidjson::SizeType i = 0; i < doc.Size(); i++) {
        auto &library = doc[i];
        if (!library.IsObject()) {
            LOGE("invalid config: expected injected_libraries members to be objects");
            return std::nullopt;
        }

        auto &path = library["path"];
        if (!path.IsString()) {
            LOGE("invalid config: expected injected_libraries.path to be a string");
            return std::nullopt;
        }

        result.emplace_back(path.GetString());
    }

    return result;
}

static std::optional<child_gating_config> deserialize_child_gating_config(const rapidjson::Value &doc) {
    if (!doc.IsObject()) {
        return std::nullopt;
    }

    child_gating_config result = {};
    result.enabled = false;
    result.mode = "freeze";

    if (doc.HasMember("enabled")) {
        auto &enabled = doc["enabled"];
        if (!enabled.IsBool()) {
            LOGE("invalid config: expected child_gating.enabled members to be a bool");
            return std::nullopt;
        }
        result.enabled = enabled.GetBool();
    }

    if (doc.HasMember("mode")) {
        auto &mode = doc["mode"];
        if (!mode.IsString()) {
            LOGE("invalid config: expected child_gating.mode members to be a string");
            return std::nullopt;
        }
        result.mode = mode.GetString();
    }

    if (doc.HasMember("injected_libraries")) {
        auto injected_libraries = deserialize_libraries(doc["injected_libraries"]);
        if (!injected_libraries.has_value()) {
            return std::nullopt;
        }
        result.injected_libraries = injected_libraries.value();
    }

    return result;
}

static std::optional<target_config> deserialize_target_config(const rapidjson::Value &doc) {
    if (!doc.IsObject()) {
        LOGE("expected config targets array to contain objects");
        return std::nullopt;
    }

    target_config result = {};
    result.enabled = true;
    result.start_up_delay_ms = 0;
    result.remap_injector = false;

    auto &app_name = doc["app_name"];
    if (!app_name.IsString()) {
        LOGE("expected config target to have a valid app_name");
        return std::nullopt;
    }
    result.app_name = app_name.GetString();

    if (doc.HasMember("enabled")) {
        auto &enabled = doc["enabled"];
        if (!enabled.IsBool()) {
            LOGE("invalid config: expected targets.enabled members to be a bool");
            return std::nullopt;
        }
        result.enabled = enabled.GetBool();
    }

    // remap_injector wins if both keys are present; kernel_assisted_evasion is the old name.
    if (doc.HasMember("remap_injector")) {
        auto &remap_injector = doc["remap_injector"];
        if (!remap_injector.IsBool()) {
            LOGE("invalid config: expected remap_injector members to be a bool");
            return std::nullopt;
        }
        result.remap_injector = remap_injector.GetBool();
    } else if (doc.HasMember("kernel_assisted_evasion")) {
        auto &kernel_assisted_evasion = doc["kernel_assisted_evasion"];
        if (!kernel_assisted_evasion.IsBool()) {
            LOGE("invalid config: expected kernel_assisted_evasion members to be a bool");
            return std::nullopt;
        }
        result.remap_injector = kernel_assisted_evasion.GetBool();
    }

    if (doc.HasMember("start_up_delay_ms")) {
        auto &start_up_delay_ms = doc["start_up_delay_ms"];
        if (!start_up_delay_ms.IsUint64()) {
            LOGE("expected config target start_up_delay_ms to be an uint64");
            return std::nullopt;
        }
        result.start_up_delay_ms = start_up_delay_ms.GetUint64();
    }

    if (doc.HasMember("injected_libraries")) {
        auto deserialized_libraries = deserialize_libraries(doc["injected_libraries"]);
        if (!deserialized_libraries.has_value()) {
            return std::nullopt;
        }
        result.injected_libraries = deserialized_libraries.value();
    }

    if (doc.HasMember("child_gating")) {
        auto child_gating = deserialize_child_gating_config(doc["child_gating"]);
        if (!child_gating.has_value()) {
            return std::nullopt;
        }
        result.child_gating = child_gating.value();
    }

    return result;
}

static std::optional<target_config> load_advanced_config(std::string const &config_path, std::string const &app_name) {
    std::ifstream config_file(config_path);
    if (!config_file.is_open()) {
        return std::nullopt;
    }

    rapidjson::IStreamWrapper config_stream{config_file};

    rapidjson::Document doc;
    doc.ParseStream(config_stream);
    config_file.close();

    if (doc.HasParseError()) {
        LOGE("config is not a valid json file offset %u: %s",
             (unsigned) doc.GetErrorOffset(),
             GetParseError_En(doc.GetParseError()));
        return std::nullopt;
    }

    if (!doc.IsObject()) {
        LOGE("config expected a json root object");
        return std::nullopt;
    }

    auto &targets = doc["targets"];
    if (!targets.IsArray()) {
        LOGE("expected config targets to be an array");
        return std::nullopt;
    }

    for (rapidjson::SizeType i = 0; i < targets.Size(); i++) {
        auto deserialized_target = deserialize_target_config(targets[i]);
        if (!deserialized_target.has_value()) {
            return std::nullopt;
        }

        auto target = deserialized_target.value();
        if (target.app_name == app_name) {
            return target;
        }
    }

    return std::nullopt;
}

std::optional<target_config> load_config(std::string const &module_dir, std::string const &app_name) {
    auto cfg = load_advanced_config(module_dir + "/config.json", app_name);
    if (cfg.has_value()) {
        return cfg;
    }

    // Module-dir mirror used when /data/local/tmp was wiped (boot-completed.sh restores it
    // asynchronously; this covers the first launch after a wipe).
    return load_advanced_config("/data/adb/modules/ksufrida/runtime/config.json", app_name);
}
