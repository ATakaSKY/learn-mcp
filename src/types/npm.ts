/**
 * npm Registry API type definitions
 */

export interface NpmMaintainer {
  name: string;
  email?: string;
}

export interface NpmPackageVersion {
  license?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface NpmPackage {
  name: string;
  description?: string;
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, NpmPackageVersion>;
  time?: Record<string, string>;
  homepage?: string;
  repository?: {
    url?: string;
  };
  bugs?: {
    url?: string;
  };
  keywords?: string[];
  maintainers?: NpmMaintainer[];
}

export interface NpmDownloads {
  downloads: number;
  package: string;
}

export interface NpmSearchPackage {
  name: string;
  version: string;
  description?: string;
}

export interface NpmSearchObject {
  package: NpmSearchPackage;
  score?: {
    final?: number;
  };
}

export interface NpmSearchResult {
  objects: NpmSearchObject[];
  total: number;
}
