const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("riv"); // Rive-Avatar-Pakete
module.exports = config;
