export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "enum";
  description: string;
  enumValues?: string;
  isRequired: boolean;
}

export interface PromptBuilderForm {
  title: string;
  objective: string;
  notes?: string;
  fields: SchemaField[];
}

export interface SavedPrompt {
  id: string;
  title: string;
  objective: string;
  notes?: string;
  content: string;
  createdAt: Date;
  fields: SchemaField[];
}