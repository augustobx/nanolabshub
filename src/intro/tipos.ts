import type { FormEvent } from "react";

export interface PropsIngreso {
  ambiente?: string | null;
  error?: string | null;
  aviso?: string | null;
  username: string;
  setUsername: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  challenge: string;
  code: string;
  setCode: (val: string) => void;
  onCancelChallenge: () => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
}
