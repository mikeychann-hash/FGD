# Wrapper for scripts/fgdctl.js
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = if ($env:NODE_BIN) { $env:NODE_BIN } else { "node" }
& $Node "$ScriptDir/fgdctl.js" @args
