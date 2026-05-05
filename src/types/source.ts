export interface Source {
  id: number;
  url: string;
  name?: string;
  extractorType?: string;
  createdAt: string | Date;
  previewImage?: string;
}
