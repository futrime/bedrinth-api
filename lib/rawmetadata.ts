export interface RawMetadata {
  format_version: number;
  tooth: string;
  version: string;
  info: {
    name: string; description: string; author: string; tags: string[];
    avatar_url?: string;
    source?: string;
  }
}
