import { useQuery, useQueryClient } from '@tanstack/react-query';
import { React } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { listWorkspace, readWorkspaceFile } from '../lib/workspace-api.js';

export function useWorkspaceBrowser(selectedPath) {
  const t = useT();
  const queryClient = useQueryClient();
  const [expandedPaths, setExpandedPaths] = React.useState(new Set());
  const [filter, setFilter] = React.useState('');
  const [result, setResult] = React.useState(null);

  const rootQuery = useQuery({
    queryKey: ['workspace-list', ''],
    queryFn: () => listWorkspace('')
  });

  const fileQuery = useQuery({
    queryKey: ['workspace-file', selectedPath],
    queryFn: () => readWorkspaceFile(selectedPath),
    enabled: Boolean(selectedPath)
  });

  const selectionIsDirectory = selectedPath === '' || fileQuery.data?.kind === 'directory';

  const listingQuery = useQuery({
    queryKey: ['workspace-list', selectedPath],
    queryFn: () => listWorkspace(selectedPath),
    enabled: selectionIsDirectory
  });

  React.useEffect(() => {
    setResult(null);
  }, [selectedPath]);

  const loadDirectory = React.useCallback(
    (path) =>
      queryClient.fetchQuery({
        queryKey: ['workspace-list', path],
        queryFn: () => listWorkspace(path)
      }),
    [queryClient]
  );

  const toggleDirectory = React.useCallback(
    async (path) => {
      const next = new Set(expandedPaths);
      if (next.has(path)) {
        next.delete(path);
        setExpandedPaths(next);
        return;
      }
      next.add(path);
      setExpandedPaths(next);
      try {
        await loadDirectory(path);
      } catch (error) {
        setResult({
          type: 'error',
          message: error.message || t('workspace.unableOpenDirectory')
        });
      }
    },
    [expandedPaths, loadDirectory, t]
  );

  return {
    rootEntries: rootQuery.data?.entries || [],
    file: fileQuery.data || null,
    selectionIsDirectory,
    currentEntries: listingQuery.data?.entries || [],
    expandedPaths,
    filter,
    setFilter,
    result,
    clearResult: () => setResult(null),
    isLoadingTree: rootQuery.isLoading,
    isLoadingFile: fileQuery.isLoading,
    isLoadingListing: listingQuery.isLoading,
    isFetching: rootQuery.isFetching || fileQuery.isFetching || listingQuery.isFetching,
    error: rootQuery.error || fileQuery.error || listingQuery.error || null,
    loadDirectory,
    toggleDirectory,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-list'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-file', selectedPath] });
    }
  };
}
