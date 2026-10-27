export interface BuildInfo {
  version: string;
  commit: string;
  dirty: boolean;
}

export const BUILD_INFO: BuildInfo = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  dirty: __APP_DIRTY__,
};

/** `v0.1.1 · f4b6a60`, with `-dirty` after the commit when the build had uncommitted changes. */
export function formatBuildLabel({ version, commit, dirty }: BuildInfo): string {
  return `v${version} · ${commit}${dirty ? '-dirty' : ''}`;
}

export const BUILD_LABEL = formatBuildLabel(BUILD_INFO);
