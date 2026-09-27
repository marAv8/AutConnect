"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AUTHORIZED_LOOKUP_MIN_LENGTH, nextAutocompleteIndex, normalizeAuthorizedLookupQuery } from "@/lib/authorizedLookupSearch";
import styles from "./AuthorizedAutocomplete.module.css";

type LookupState = "prompt" | "loading" | "results" | "empty" | "error" | "selected" | "closed";

export function AuthorizedAutocomplete<T>({
  label,
  placeholder,
  selected,
  onSelectionChange,
  search,
  getKey,
  getLabel,
  renderOption,
  emptyMessage,
}: {
  label: string;
  placeholder: string;
  selected: T | null;
  onSelectionChange: (item: T | null) => void;
  search: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  renderOption: (item: T) => ReactNode;
  emptyMessage: string;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const statusId = `${id}-status`;
  const [query, setQuery] = useState(selected ? getLabel(selected) : "");
  const [results, setResults] = useState<T[]>([]);
  const [state, setState] = useState<LookupState>("prompt");
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (selected && query === getLabel(selected)) return;
    const normalized = normalizeAuthorizedLookupQuery(query);
    if (normalized.length < AUTHORIZED_LOOKUP_MIN_LENGTH) return;
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const matches = await search(normalized);
        if (sequence !== requestSequence.current) return;
        setResults(matches);
        setActiveIndex(matches.length ? 0 : -1);
        setState(matches.length ? "results" : "empty");
      } catch {
        if (sequence !== requestSequence.current) return;
        setResults([]);
        setActiveIndex(-1);
        setState("error");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, search, selected, getLabel]);

  const choose = (item: T) => {
    requestSequence.current += 1;
    onSelectionChange(item);
    setQuery(getLabel(item));
    setResults([]);
    setActiveIndex(-1);
    setState("selected");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      const navigationKey = event.key;
      setActiveIndex((current) => nextAutocompleteIndex(current, results.length, navigationKey));
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setResults([]);
      setActiveIndex(-1);
      setState("closed");
    }
  };

  const status = state === "loading"
    ? "Loading suggestions."
    : state === "empty"
      ? emptyMessage
      : state === "error"
        ? "Search unavailable. Try again."
        : state === "selected"
          ? "Selection ready."
          : state === "closed"
            ? "Suggestions closed. Continue typing to search."
        : state === "results"
          ? `${results.length} suggestion${results.length === 1 ? "" : "s"} available.`
          : `Type at least ${AUTHORIZED_LOOKUP_MIN_LENGTH} letters.`;

  return <div className={styles.lookup}>
    <label htmlFor={inputId} className={styles.label}>{label}</label>
    <div className={styles.inputRow}>
      <input
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={statusId}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setResults([]);
          setActiveIndex(-1);
          setState(normalizeAuthorizedLookupQuery(nextQuery).length >= AUTHORIZED_LOOKUP_MIN_LENGTH ? "loading" : "prompt");
          if (selected) onSelectionChange(null);
        }}
        onKeyDown={onKeyDown}
      />
      {selected ? <button type="button" className="material-control action-secondary" onClick={() => {
        requestSequence.current += 1;
        onSelectionChange(null);
        setQuery("");
        setResults([]);
        setState("prompt");
      }}>Clear</button> : null}
    </div>
    <p id={statusId} className={state === "error" ? styles.error : styles.status} role={state === "error" ? "alert" : "status"} aria-live="polite">{status}</p>
    {results.length ? <div id={listboxId} role="listbox" aria-label={`${label} suggestions`} className={styles.listbox}>
      {results.map((item, index) => <button
        key={getKey(item)}
        id={`${id}-option-${index}`}
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={styles.option}
        onPointerDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(item)}
      >{renderOption(item)}</button>)}
    </div> : null}
  </div>;
}
