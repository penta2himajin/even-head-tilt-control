import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { H, W } from './constants.ts'
import { formatListItems } from './format.ts'
import type { AppSnapshot } from './types.ts'

export const TITLE_ID = 1
export const LIST_ID = 2
export const TITLE_NAME = 'title'
export const LIST_NAME = 'controls'

function titleText(statusLine: string) {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: 36,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: TITLE_ID,
    containerName: TITLE_NAME,
    content: statusLine,
    textColor: 4,
    isEventCapture: 0,
  })
}

function listText(snapshot: AppSnapshot) {
  const items = formatListItems(
    snapshot.bindings,
    snapshot.focusedIndex,
    snapshot.bindingControl,
  )
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 36,
    width: W,
    height: H - 36,
    borderWidth: 1,
    borderColor: 5,
    paddingLength: 4,
    containerID: LIST_ID,
    containerName: LIST_NAME,
    // Text capture: temple swipe arrives as SCROLL_TOP/BOTTOM so we can
    // move our own ">" cursor. Native ListContainer border was drifting
    // without listEvent index updates.
    isEventCapture: 1,
    content: items.join('\n'),
    textColor: 4,
  })
}

function statusLine(snapshot: AppSnapshot): string {
  if (snapshot.mode === 'binding' && snapshot.bindingControl) {
    return `Bind: ${snapshot.bindingControl}`
  }
  const last = snapshot.logs.at(-1)
  if (last) {
    return `control: ${last.control}`
  }
  return 'Head tilt test'
}

export function listContent(snapshot: AppSnapshot): string {
  return formatListItems(
    snapshot.bindings,
    snapshot.focusedIndex,
    snapshot.bindingControl,
  ).join('\n')
}

export function buildStartupPage(snapshot: AppSnapshot) {
  return new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [titleText(statusLine(snapshot)), listText(snapshot)],
  })
}

export function buildRebuildPage(snapshot: AppSnapshot) {
  return new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [titleText(statusLine(snapshot)), listText(snapshot)],
  })
}

export function buildTitleUpgrade(snapshot: AppSnapshot) {
  return new TextContainerUpgrade({
    containerID: TITLE_ID,
    containerName: TITLE_NAME,
    content: statusLine(snapshot),
  })
}

export function buildListUpgrade(snapshot: AppSnapshot) {
  return new TextContainerUpgrade({
    containerID: LIST_ID,
    containerName: LIST_NAME,
    content: listContent(snapshot),
  })
}
