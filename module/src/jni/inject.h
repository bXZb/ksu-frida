#ifndef KSUFRIDA_INJECT_H
#define KSUFRIDA_INJECT_H

#include <string>

void inject_lib(std::string const& lib_path, std::string const& logContext, bool remap_now = true);
bool check_and_inject(std::string const& app_name);

#endif  // KSUFRIDA_INJECT_H
