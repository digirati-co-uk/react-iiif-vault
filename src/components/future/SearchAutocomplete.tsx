import { useAutocomplete, useSearch } from '../../context/SearchContext';

export function SearchAutocomplete() {
  const search = useSearch();

  if (!search.hasAutocomplete) {
    return null;
  }

  return <SearchAutocompleteInner />;
}

function SearchAutocompleteInner() {
  const { results, loading, error, errorMessage, search } = useAutocomplete();
  const { search: searchFull } = useSearch();

  let inputClassName = 'border border-gray-300 rounded-md p-2';
  if (loading) {
    inputClassName += ' bg-gray-100 transition-background duration-200';
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    searchFull({ q: results[0].match });
  };

  return (
    <form onSubmit={submit}>
      <input
        className={inputClassName}
        type="text"
        onChange={(e) => search(e.target.value)}
        placeholder="Search"
        aria-label="Search"
      />
      {error && <div>{errorMessage}</div>}
      <ul>
        {results.map((result) => (
          <li
            key={result.url}
            onClick={() => {
              searchFull({ q: result.match });
            }}
          >
            {result.match}
          </li>
        ))}
      </ul>
    </form>
  );
}
