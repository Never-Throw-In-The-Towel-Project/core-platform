/**
 * The Library layout hosts a `@modal` parallel slot alongside the normal page
 * content. Clicking a content card soft-navigates to /content/[id], which the
 * `@modal/(.)[id]` intercepting route captures — so the video plays in a modal
 * over the Library rather than on a separate page. A hard load / refresh /
 * shared link to /content/[id] isn't intercepted and renders the full page
 * (content/[id]/page.tsx). See node_modules/next/dist/docs — Intercepting +
 * Parallel Routes.
 */
export default function ContentLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
