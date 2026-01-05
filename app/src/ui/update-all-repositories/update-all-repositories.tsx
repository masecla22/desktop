import memoizeOne from 'memoize-one'
import * as React from 'react'
import { ILocalRepositoryState, Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Button } from '../lib/button'
import { SectionFilterList } from '../lib/section-filter-list'
import { RepositoryListItem } from './update-all-repositories-list-item'
import { getGroupKey, groupRepositories, IRepositoryListItem, Repositoryish, RepositoryListGroup } from './group-repositories'
import { IMatches } from '../../lib/fuzzy-find'
import { TooltippedContent } from '../lib/tooltipped-content'
import { enableMultipleEnterpriseAccounts } from '../../lib/feature-flag'
import { assertNever } from '../../lib/fatal-error'
import { Popover, PopoverDecoration, PopoverAnchorPosition } from '../lib/popover'
import { MenuPane } from '../app-menu/menu-pane'
import { MenuItem } from '../../models/app-menu'


export interface IRepositoryActionOption {
  readonly id: RepositoryAction
  readonly label: string
}

interface IUpdateAllRepositoriesProps {
  readonly onDismissed: () => void

  readonly repositories: ReadonlyArray<Repositoryish> | null
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >
  readonly recentRepositories: ReadonlyArray<number>
}

export type RepositoryAction = 
  | 'fetch'
  | 'fetch-pull'
  | 'fetch-pull-push'
  | 'remove'
  | 'locate'

interface IUpdateAllRepositoriesState {
  readonly filterText: string
  readonly repositoryActions: Map<number, RepositoryAction>
  readonly openPopoverRepositoryId: number | null
  readonly openPopoverButtonRef: HTMLElement | null
  readonly selectedMenuItem: MenuItem | undefined
}

const RowHeight = 40

export class UpdateAllRepositories extends
  React.Component<
    IUpdateAllRepositoriesProps,
    IUpdateAllRepositoriesState
  > {

  public constructor(props: IUpdateAllRepositoriesProps) {
    super(props)

    this.state = {
      filterText: '',
      repositoryActions: this.initializeRepositoryActions(props.repositories),
      openPopoverRepositoryId: null,
      openPopoverButtonRef: null,
      selectedMenuItem: undefined,
    }
  }

  private initializeRepositoryActions(
    repositories: ReadonlyArray<Repositoryish> | null
  ): Map<number, RepositoryAction> {
    const actions = new Map<number, RepositoryAction>()
    if (repositories === null) {
      return actions
    }

    for (const repo of repositories) {
      if (repo instanceof Repository && repo.missing) {
        actions.set(repo.id, 'remove')
      } else {
        actions.set(repo.id, 'fetch-pull')
      }
    }
    return actions
  }

  private getActionOptions(repository: Repositoryish): ReadonlyArray<IRepositoryActionOption> {
    if (repository instanceof Repository && repository.missing) {
      return [
        { id: 'remove', label: 'Remove' },
        { id: 'locate', label: 'Locate' },
      ]
    }

    return [
      { id: 'fetch', label: 'Fetch' },
      { id: 'fetch-pull', label: 'Fetch & Pull' },
      { id: 'fetch-pull-push', label: 'Fetch, Pull & Push' },
    ]
  }

  private onActionChanged = (repositoryId: number, action: RepositoryAction) => {
    const newActions = new Map(this.state.repositoryActions)
    newActions.set(repositoryId, action)
    this.setState({ repositoryActions: newActions, openPopoverRepositoryId: null, openPopoverButtonRef: null })
  }

  private onOpenPopover = (repositoryId: number, buttonRef: HTMLElement) => {
    this.setState({ openPopoverRepositoryId: repositoryId, openPopoverButtonRef: buttonRef })
  }

  private onClosePopover = () => {
    this.setState({ openPopoverRepositoryId: null, openPopoverButtonRef: null, selectedMenuItem: undefined })
  }

  private onMenuSelectionChanged = (depth: number, item: MenuItem) => {
    this.setState({ selectedMenuItem: item })
  }

  private onClearMenuSelection = () => {
    this.setState({ selectedMenuItem: undefined })
  }

  private getRepositoryGroups = memoizeOne(
    (
      repositories: ReadonlyArray<Repositoryish> | null,
      localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
      recentRepositories: ReadonlyArray<number>
    ) =>
      repositories === null
        ? []
        : groupRepositories(
          repositories,
          localRepositoryStateLookup,
          recentRepositories
        )
  )

  private renderItem = (item: IRepositoryListItem, matches: IMatches) => {
    const repository = item.repository
    const currentAction = this.state.repositoryActions.get(repository.id)

    return (
      <RepositoryListItem
        repository={repository}
        needsDisambiguation={item.needsDisambiguation}
        matches={matches}
        aheadBehind={item.aheadBehind}
        selectedAction={currentAction}
        onOpenPopover={(buttonRef) => this.onOpenPopover(repository.id, buttonRef)}
      />
    )
  }

  private getGroupLabel(group: RepositoryListGroup) {
    const { kind } = group
    if (kind === 'enterprise') {
      return enableMultipleEnterpriseAccounts() ? group.host : 'Enterprise'
    } else if (kind === 'other') {
      return 'Other'
    } else if (kind === 'dotcom') {
      return group.owner.login
    } else if (kind === 'recent') {
      return 'Recent'
    } else {
      assertNever(kind, `Unknown repository group kind ${kind}`)
    }
  }

  private renderGroupHeader = (group: RepositoryListGroup) => {
    const label = this.getGroupLabel(group)

    return (
      <TooltippedContent
        key={getGroupKey(group)}
        className="filter-list-group-header"
        tooltip={label}
        onlyWhenOverflowed={true}
        tagName="div"
      >
        {label}
      </TooltippedContent>
    )
  }

  private onApplyActions = () => {
    console.log('Applying actions:', this.state.repositoryActions)
    // TODO: Implement actual actions
    this.props.onDismissed()
  }

  private renderNoItems = () => {
    return (
      <div className="no-items no-results-found">
        No repositories match your search.
      </div>
    )
  }

  private onFilterTextChanged = (filterText: string) => {
    this.setState({ filterText })
  }

  private renderDialogContent() {
    const groups = this.getRepositoryGroups(
      this.props.repositories,
      this.props.localRepositoryStateLookup,
      this.props.recentRepositories
    )

    return (
      <div className="update-all-repositories-list">
        <SectionFilterList
          rowHeight={RowHeight}
          filterText={this.state.filterText}
          onFilterTextChanged={this.onFilterTextChanged}
          renderItem={this.renderItem}
          renderGroupHeader={this.renderGroupHeader}
          renderNoItems={this.renderNoItems}
          groups={groups}
          invalidationProps={{
            repositories: this.props.repositories,
            filterText: this.state.filterText,
          }}
          selectedItem={null}
        />
      </div>
    )
  }

  private renderPopover() {
    const { openPopoverRepositoryId, openPopoverButtonRef } = this.state
    
    if (!openPopoverRepositoryId || !openPopoverButtonRef) {
      return null
    }

    const repository = this.props.repositories?.find(r => r.id === openPopoverRepositoryId)
    if (!repository) {
      return null
    }

    const actionOptions = this.getActionOptions(repository)
    // const currentAction = this.state.repositoryActions.get(openPopoverRepositoryId)

    const menuItems: MenuItem[] = actionOptions.map(option => ({
      id: option.id,
      label: option.label,
      type: 'menuItem' as const,
      enabled: true,
      visible: true,
      accelerator: null,
      accessKey: null,
    }))

    // const selectedItem = menuItems.find(item => item.id === currentAction)

    return (
      <Popover
        className="update-all-repositories-popover"
        anchor={openPopoverButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomLeft}
        decoration={PopoverDecoration.Balloon}
        onClickOutside={this.onClosePopover}
        trapFocus={false}
      >
        <MenuPane
          depth={0}
          items={menuItems}
          selectedItem={this.state.selectedMenuItem}
          onItemClicked={(depth, item, source) => {
            this.onActionChanged(openPopoverRepositoryId, item.id as RepositoryAction)
          }}
          onSelectionChanged={this.onMenuSelectionChanged}
          onClearSelection={this.onClearMenuSelection}
        />
      </Popover>
    )
  }

  public render() {
    return (
      <Dialog
        id="update-all-repositories"
        title={
          __DARWIN__ ? 'Update All Repositories' : 'Update all repositories'
        }
      >
        <DialogContent className="update-all-repositories-content">{this.renderDialogContent()}</DialogContent>
        {this.renderPopover()}
        <DialogFooter>
          <Button type="submit" onClick={this.onApplyActions}>
            Apply actions
          </Button>
          <Button onClick={this.props.onDismissed}>Cancel</Button>
        </DialogFooter>
      </Dialog>
    )
  }
}
