const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const HELPERS = `
# expo-sqlite's podspec copies vendor/sqlite3 into its ios/ directory because
# CocoaPods cannot compile sources outside the pod. pnpm reinstalls that
# package from the store and deletes the copies, which leaves the Pods header
# symlink broken. Restore the sources before podspecs load.
def restore_expo_sqlite_sources!(podfile_properties)
  use_sqlcipher = podfile_properties['expo.sqlite.useSQLCipher'] == 'true'
  vendor_name = use_sqlcipher ? 'sqlcipher' : 'sqlite3'
  package_root = File.expand_path('../node_modules/expo-sqlite', __dir__)
  vendor_dir = File.join(package_root, 'vendor', vendor_name)
  dest_dir = File.join(package_root, 'ios')
  return unless File.directory?(vendor_dir)

  ['sqlite3.c', 'sqlite3.h'].each do |file|
    source = File.join(vendor_dir, file)
    destination = File.join(dest_dir, file)
    next unless File.file?(source)
    next if File.file?(destination) && File.size(destination) == File.size(source)

    FileUtils.cp(source, destination)
  end
end

# Clang builds the ExpoSQLite module from the umbrella header and does not
# reliably apply OTHER_CFLAGS / -Xcc -D flags. The session APIs Swift calls
# are wrapped in SQLITE_ENABLE_SESSION, so define it in the umbrella itself.
def patch_expo_sqlite_umbrella!(installer)
  umbrella = File.join(installer.sandbox.root, 'Target Support Files/ExpoSQLite/ExpoSQLite-umbrella.h')
  return unless File.file?(umbrella)

  contents = File.read(umbrella)
  needle = '#import "sqlite3.h"'
  return unless contents.include?(needle)

  marker = '#define SQLITE_ENABLE_SESSION 1'
  contents = contents.sub("#{marker}\\n#define SQLITE_ENABLE_PREUPDATE_HOOK 1\\n", '')
  replacement = "#{marker}\\n#define SQLITE_ENABLE_PREUPDATE_HOOK 1\\n#{needle}"
  File.write(umbrella, contents.sub(needle, replacement))
end

restore_expo_sqlite_sources!(podfile_properties)
`;

const PROPERTIES_ANCHOR =
  "podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}\n";

const POST_INSTALL_ANCHOR = `:ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;

function ensureExpoSqlitePodfile(contents) {
  let next = contents;
  if (!next.includes("require 'fileutils'")) {
    next = next.replace("require 'json'\n", "require 'json'\nrequire 'fileutils'\n");
  }
  if (!next.includes("def restore_expo_sqlite_sources!")) {
    if (!next.includes(PROPERTIES_ANCHOR)) {
      throw new Error(
        "with-expo-sqlite-ios could not find the Podfile properties anchor",
      );
    }
    next = next.replace(PROPERTIES_ANCHOR, `${PROPERTIES_ANCHOR}${HELPERS}`);
  }
  if (!next.includes("patch_expo_sqlite_umbrella!(installer)")) {
    if (!next.includes(POST_INSTALL_ANCHOR)) {
      throw new Error(
        "with-expo-sqlite-ios could not find the Podfile post_install anchor",
      );
    }
    next = next.replace(
      POST_INSTALL_ANCHOR,
      `${POST_INSTALL_ANCHOR}    patch_expo_sqlite_umbrella!(installer)\n`,
    );
  }
  return next;
}

function withExpoSqliteIos(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      const contents = fs.readFileSync(podfilePath, "utf8");
      const next = ensureExpoSqlitePodfile(contents);
      if (next !== contents) {
        fs.writeFileSync(podfilePath, next);
      }
      return config;
    },
  ]);
}

module.exports = withExpoSqliteIos;
module.exports.ensureExpoSqlitePodfile = ensureExpoSqlitePodfile;
