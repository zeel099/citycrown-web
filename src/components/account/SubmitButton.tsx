"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
  /** For a second button in the same form that runs a different server action. */
  formAction?: (formData: FormData) => void | Promise<void>;
};

/** Submit button for server-action forms that shows progress while the action runs. */
export function SubmitButton({ children, pendingLabel, className, formAction }: Props) {
  const { pending, action } = useFormStatus();
  const mine = pending && (!formAction || action === formAction);
  return (
    <button type="submit" className={className} formAction={formAction} disabled={pending} aria-busy={mine}>
      {mine ? pendingLabel : children}
    </button>
  );
}
