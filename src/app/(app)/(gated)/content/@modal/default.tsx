// The @modal slot renders nothing unless the intercepting route ((.)[id]) is
// active — i.e. on any view of the Library that isn't opening a watch modal, and
// on a hard load of /content/[id] (where the full page renders in `children`).
export default function Default() {
  return null;
}
