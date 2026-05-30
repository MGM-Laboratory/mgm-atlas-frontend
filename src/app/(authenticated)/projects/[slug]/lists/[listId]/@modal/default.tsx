// The parallel `@modal` slot collapses to nothing when no intercepting
// route matches. Without this default, Next.js would 404 the slot on
// every non-task page (Overview / List / etc.).
export default function ModalDefault() {
  return null;
}
