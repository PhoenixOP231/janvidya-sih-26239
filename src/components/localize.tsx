"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useApp } from "./providers";

/** A React render boundary for shared UI copy, including server-rendered children.
 * Keeps canonical option values, event handlers, IDs and user input untouched.
 * Use translate="no" for free-form evidence, names, messages and source documents.
 */
export function Localize({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  function visit(node: ReactNode): ReactNode {
    if (typeof node === "string") return t(node);
    if (Array.isArray(node)) return Children.map(node, visit);
    if (!isValidElement<Record<string, unknown>>(node)) return node;
    const props = node.props;
    if (
      props.translate === "no" ||
      ["script", "style", "pre", "code"].includes(String(node.type))
    )
      return node;
    const changes: Record<string, unknown> = {};
    for (const key of ["title", "placeholder", "aria-label", "alt"]) {
      if (typeof props[key] === "string")
        changes[key] = t(props[key] as string);
    }
    if (props.children !== undefined && node.type !== "textarea") {
      const list = Children.toArray(props.children as ReactNode);
      // Keep a sentence with interpolated numbers together for Hindi word order.
      changes.children = list.every(
        (x) => typeof x === "string" || typeof x === "number",
      )
        ? t(list.join(""))
        : Children.map(props.children as ReactNode, visit);
      if (node.type === "option" && props.value === undefined)
        changes.value = list.join("");
    }
    return cloneElement(node, changes);
  }
  return hydrated ? visit(children) : children;
}
