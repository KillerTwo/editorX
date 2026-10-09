import { useSyncExternalStore } from 'react'
import { isMacPlatform } from './shortcuts'

const subscribe = () => () => {}
const serverSnapshot = () => false

/** 服务端与水合首帧为 false（不读取 navigator），客户端随后取真实平台 */
export function useIsMacPlatform(): boolean {
  return useSyncExternalStore(subscribe, isMacPlatform, serverSnapshot)
}
