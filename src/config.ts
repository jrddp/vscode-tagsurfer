import * as vscode from "vscode";

const defaultConfig = {
  defaultInlineTag: "span",
  defaultBlockTag: "div",
  defaultSelfClosingTag: "div",
  autoRename: false,
};

type ConfigKeys = keyof typeof defaultConfig;

type SettingType<T extends ConfigKeys> = (typeof defaultConfig)[T];

export function getSetting<T extends ConfigKeys>(settingName: T): SettingType<T> {
  const config = vscode.workspace.getConfiguration("tagSurfer");
  return config.get(settingName, defaultConfig[settingName]) as SettingType<T>;
}
