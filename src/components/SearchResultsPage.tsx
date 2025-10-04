import { useState, useEffect, useMemo } from 'react';
import { SearchBar } from './SearchBar';
import { FilterSidebar } from './FilterSidebar';
import { RepositoryCard } from './RepositoryCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Repository } from '../lib/mock-data';
import { searchRepositories, convertToRepository, type SearchFilters } from '../lib/github-api';
import { Loader2 } from 'lucide-react';

interface SearchResultsPageProps {
  repositories: Repository[];
  initialQuery?: string;
  onViewDetails: (repo: Repository) => void;
  onCompare: (repos: Repository[]) => void;
}

export function SearchResultsPage({
  repositories: initialRepositories,
  initialQuery = '',
  onViewDetails,
  onCompare
}: SearchResultsPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState('health');
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [comparing, setComparing] = useState<string[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>(initialRepositories);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    languages: [],
    activityDays: 30,
    healthRange: [0, 100],
    hasGoodFirstIssues: false,
  });

  const handleBookmark = (repoId: string) => {
    setBookmarked(prev =>
      prev.includes(repoId) ? prev.filter(id => id !== repoId) : [...prev, repoId]
    );
  };

  const handleCompare = (repoId: string) => {
    setComparing(prev => {
      const newComparing = prev.includes(repoId)
        ? prev.filter(id => id !== repoId)
        : prev.length < 3
          ? [...prev, repoId]
          : prev;

      if (newComparing.length >= 2) {
        const selectedRepos = repositories.filter(r => newComparing.includes(r.id));
        onCompare(selectedRepos);
      }

      return newComparing;
    });
  };

  // Memoize filter values to prevent unnecessary re-renders
  const filterKey = useMemo(() => 
    JSON.stringify(filters),
    [filters]
  );

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() && filters.languages.length === 0) {
        setRepositories(initialRepositories);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await searchRepositories(searchQuery, filters);
        const convertedRepos = results.items.map(repo => convertToRepository(repo, 0));

        const filteredByHealth = convertedRepos.filter(
          repo => repo.healthScore >= filters.healthRange[0] &&
                  repo.healthScore <= filters.healthRange[1]
        );

        setRepositories(filteredByHealth);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search repositories');
        setRepositories([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterKey, initialRepositories, filters]);

  const sortedRepos = useMemo(() => {
    return [...repositories].sort((a, b) => {
      switch (sortBy) {
        case 'health':
          return b.healthScore - a.healthScore;
        case 'stars':
          return b.stars - a.stars;
        case 'activity':
          return new Date(b.lastCommit).getTime() - new Date(a.lastCommit).getTime();
        case 'issues':
          return b.goodFirstIssues - a.goodFirstIssues;
        default:
          return 0;
      }
    });
  }, [repositories, sortBy]);

  return (
    <div className="flex h-screen">
      <FilterSidebar onFilterChange={setFilters} />
      
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border bg-background sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={() => {}}
              className="mb-4"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? 'Searching...' : `Showing ${repositories.length} repositories`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health">Health Score (default)</SelectItem>
                    <SelectItem value="stars">Stars</SelectItem>
                    <SelectItem value="activity">Recent Activity</SelectItem>
                    <SelectItem value="issues">Good First Issues</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && sortedRepos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No repositories found. Try adjusting your search or filters.</p>
            </div>
          )}

          {!loading && !error && sortedRepos.length > 0 && (
            <div className="grid gap-6">
              {sortedRepos.map((repo) => (
                <RepositoryCard
                  key={repo.id}
                  repo={repo}
                  onViewDetails={() => onViewDetails(repo)}
                  onBookmark={() => handleBookmark(repo.id)}
                  isBookmarked={bookmarked.includes(repo.id)}
                  onCompare={() => handleCompare(repo.id)}
                  isComparing={comparing.includes(repo.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
