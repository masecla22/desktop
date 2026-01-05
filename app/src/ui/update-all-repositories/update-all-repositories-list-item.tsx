import * as React from 'react'

import { Repository } from '../../models/repository'
import { Octicon, iconForRepository } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Repositoryish } from '../repositories-list/group-repositories'
import { HighlightText } from '../lib/highlight-text'
import { IMatches } from '../../lib/fuzzy-find'
import { IAheadBehind } from '../../models/branch'
import classNames from 'classnames'
import { createObservableRef } from '../lib/observable-ref'
import { Tooltip } from '../lib/tooltip'
import { enableAccessibleListToolTips } from '../../lib/feature-flag'
import { TooltippedContent } from '../lib/tooltipped-content'
import { RepositoryAction } from './update-all-repositories'
import { Button } from '../lib/button'

interface IRepositoryListItemProps {
  readonly repository: Repositoryish

  /** Does the repository need to be disambiguated in the list? */
  readonly needsDisambiguation: boolean

  /** The characters in the repository name to highlight */
  readonly matches: IMatches

  /** Number of commits this local repo branch is behind or ahead of its remote branch */
  readonly aheadBehind: IAheadBehind | null

  /** The currently selected action */
  readonly selectedAction?: RepositoryAction

  /** Callback when popover should be opened */
  readonly onOpenPopover: (buttonRef: HTMLElement) => void
}

/** A repository item. */
export class RepositoryListItem extends React.Component<
  IRepositoryListItemProps,
  {}
> {
  private readonly listItemRef = createObservableRef<HTMLDivElement>()
  private buttonRef: HTMLButtonElement | null = null

  private onButtonRef = (ref: HTMLButtonElement | null) => {
    this.buttonRef = ref
  }

  private onButtonClick = () => {
    if (this.buttonRef) {
      this.props.onOpenPopover(this.buttonRef)
    }
  }

  private getSelectedActionLabel(): string {
    switch (this.props.selectedAction) {
      case 'fetch':
        return 'Fetch'
      case 'fetch-pull':
        return 'Fetch & Pull'
      case 'fetch-pull-push':
        return 'Fetch, Pull & Push'
      case 'remove':
        return 'Remove'
      case 'locate':
        return 'Locate'
      default:
        return 'Select action'
    }
  }

  public render() {
    const repository = this.props.repository
    const gitHubRepo =
      repository instanceof Repository ? repository.gitHubRepository : null

    const alias: string | null =
      repository instanceof Repository ? repository.alias : null

    let prefix: string | null = null
    if (this.props.needsDisambiguation && gitHubRepo) {
      prefix = `${gitHubRepo.owner.login}/`
    }

    const classNameList = classNames('name', {
      alias: alias !== null,
    })

    const hasPendingPush = this.props.aheadBehind && this.props.aheadBehind.ahead > 0

    return (
      <div className="repository-list-item" ref={this.listItemRef}>
        <Tooltip
          target={this.listItemRef}
          disabled={enableAccessibleListToolTips()}
        >
          {this.renderTooltip()}
        </Tooltip>

        <Octicon
          className="icon-for-repository"
          symbol={iconForRepository(repository)}
        />

        <div className={classNames(classNameList)}>
          {prefix ? <span className="prefix">{prefix}</span> : null}
          <HighlightText
            text={alias ?? repository.name}
            highlight={this.props.matches.title}
          />
          {hasPendingPush && (
            <TooltippedContent
              className="pending-push-indicator"
              tooltip={`${this.props.aheadBehind!.ahead} commit${this.props.aheadBehind!.ahead > 1 ? 's' : ''} to push`}
              disabled={enableAccessibleListToolTips()}
            >
              <Octicon symbol={octicons.arrowUp} />
            </TooltippedContent>
          )}
        </div>

        <Button
          className="repository-action-button"
          onClick={this.onButtonClick}
          onButtonRef={this.onButtonRef}
        >
          <span className="button-label">{this.getSelectedActionLabel()}</span>
          <Octicon symbol={octicons.triangleDown} />
        </Button>
      </div>
    )
  }

  private renderTooltip() {
    const repo = this.props.repository
    const gitHubRepo = repo instanceof Repository ? repo.gitHubRepository : null
    const alias = repo instanceof Repository ? repo.alias : null
    const realName = gitHubRepo ? gitHubRepo.fullName : repo.name

    return (
      <>
        <div>
          <strong>{realName}</strong>
          {alias && <> ({alias})</>}
        </div>
        <div>{repo.path}</div>
      </>
    )
  }

  public shouldComponentUpdate(nextProps: IRepositoryListItemProps): boolean {
    if (
      nextProps.repository instanceof Repository &&
      this.props.repository instanceof Repository
    ) {
      return (
        nextProps.repository.id !== this.props.repository.id ||
        nextProps.matches !== this.props.matches ||
        nextProps.selectedAction !== this.props.selectedAction ||
        nextProps.aheadBehind !== this.props.aheadBehind
      )
    } else {
      return true
    }
  }
}
