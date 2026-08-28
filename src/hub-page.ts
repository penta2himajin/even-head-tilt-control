import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { H, W } from './constants.ts'
import { formatListItems } from './format.ts'
import type { AppSnapshot } from './types.ts'

const TITLE_ID = 1
const LIST_ID = 2

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
    containerName: 'title',
    content: statusLine,
    textColor: 4,
    isEventCapture: 0,
  })
}

function listBlock(snapshot: AppSnapshot) {
  const items = formatListItems(
    snapshot.bindings,
    snapshot.focusedIndex,
    snapshot.bindingControl,
  )
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: 36,
    width: W,
    height: H - 36,
    borderWidth: 1,
    borderColor: 5,
    paddingLength: 2,
    containerID: LIST_ID,
    containerName: 'controls',
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: W - 8,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
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

export function buildStartupPage(snapshot: AppSnapshot) {
  return new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [titleText(statusLine(snapshot))],
    listObject: [listBlock(snapshot)],
  })
}

export function buildRebuildPage(snapshot: AppSnapshot) {
  return new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [titleText(statusLine(snapshot))],
    listObject: [listBlock(snapshot)],
  })
}
