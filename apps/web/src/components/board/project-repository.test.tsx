import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@bh/ui';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { Project } from '../../api/types';
import { ProjectRepository } from './project-repository';

function project(repository: Partial<Project>): Project {
  return {
    id: 1, key: 'tickets', name: 'Tickets', schemeId: 1, itemPrefix: 'TK', createdAt: '2026-01-01T00:00:00.000Z',
    repositoryUrl: null, defaultBranch: null, ...repository,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a GitHub link opens on GitHub, in a new tab', () => {
  render(<ProjectRepository project={project({ repositoryUrl: 'https://github.com/bendela6/tickets.git' })} />, { wrapper: TooltipProvider });
  const link = screen.getByRole('link', { name: 'github.com/bendela6/tickets' });
  expect(link).toHaveAttribute('href', 'https://github.com/bendela6/tickets');
  expect(link).toHaveAttribute('target', '_blank');
  expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
});

test('an ssh link shows as text, with a button that copies it', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  render(<ProjectRepository project={project({ repositoryUrl: 'git@github.com:bendela6/tickets.git' })} />, { wrapper: TooltipProvider });

  expect(screen.getByText('git@github.com:bendela6/tickets.git')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(writeText).toHaveBeenCalledWith('git@github.com:bendela6/tickets.git');
});

test('the default branch shows when one is set, and not otherwise', () => {
  const { rerender } = render(
    <ProjectRepository project={project({ repositoryUrl: 'https://github.com/bendela6/tickets', defaultBranch: 'main' })} />,
    { wrapper: TooltipProvider },
  );
  expect(screen.getByText('main')).toHaveTextContent('default branch main');

  rerender(<ProjectRepository project={project({ repositoryUrl: 'https://github.com/bendela6/tickets' })} />);
  expect(screen.queryByText('main')).not.toBeInTheDocument();
});

test('a project with no repository shows nothing', () => {
  const { container } = render(<ProjectRepository project={project({})} />, { wrapper: TooltipProvider });
  expect(container).toBeEmptyDOMElement();
});
