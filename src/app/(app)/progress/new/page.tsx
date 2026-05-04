import { EntryForm } from "@/components/entry-form";

export default function NewEntryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          New entry
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Duration is calculated automatically when both times are filled.
        </p>
      </header>
      <EntryForm mode="create" initial={{}} />
    </div>
  );
}
