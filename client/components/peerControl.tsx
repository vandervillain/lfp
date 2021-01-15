import React, { CSSProperties, useEffect, useState } from 'react'
import { useWebsocket } from '../contexts/socketManager'
import { useStream } from '../contexts/streamManager'
import Dragbar from './dragbar'
import Visualizer from './visualizer'

type PeerControlProps = {
  peerId: string
  inCall: boolean
  isOutputting: boolean
}

type PeerControlState = {
  gain: number
  threshold: number
}

const PeerControl = ({ peerId, inCall, isOutputting }: PeerControlProps) => {
  const streamMgr = useStream()
  const ws = useWebsocket()
  const [state, setState] = useState<PeerControlState>({
    gain: 25,
    threshold: 25,
  })
  const renderMute = (id: string) => <button onClick={() => streamMgr.toggleStream(peerId)}>mute</button>

  const peerStyle = () => {
    const properties = {} as CSSProperties
    properties.fontWeight = inCall ? 'bold' : 'normal'
    properties.boxShadow = inCall ? '0 0 3px 3px #999' : ''
    return properties
  }

  const onChangeThreshold = (p: number) => {
    streamMgr.getStream(peerId)?.setThreshold(p / 100)
    setState((prev) => ({ ...prev, threshold: p }))
  }

  const onChangeGain = (p: number) => {
    streamMgr.getStream(peerId)?.setGain(p / 100)
    setState((prev) => ({ ...prev, gain: p }))
  }

  const avatarStyle = () => {
    const style: CSSProperties = {}
    if (isOutputting) style.boxShadow = '0 0 5px 5px #4caf50'
    return style
  }

  useEffect(() => {
    console.log(`peerControl useEffect`)
    if (inCall) streamMgr.connectIsStreamingVolume(peerId, (o) => ws.changePeerOutput(peerId, o))

    return () => {
      if (!inCall) streamMgr.disconnectIsStreamingVolume(peerId)
    }
  }, [inCall])

  return (
    <div className='peer' key={peerId} style={peerStyle()}>
      <img className='avatar' src='/images/avatar.png' alt={peerId} width='100px' height='100px' style={avatarStyle()} />
      <div className='username'>{peerId}</div>
      {inCall && (
        <div className='threshold'>
          <Visualizer id={peerId} />
          <Dragbar initialValue={state.threshold} onChange={(p) => onChangeThreshold(p)} />
          <Dragbar initialValue={state.gain} onChange={(p) => onChangeGain(p)} />
        </div>
      )}
      <div className='controls'>{renderMute(peerId)}</div>
      <style jsx>{`
        .peer {
          display: grid;
          grid-template-areas:
            'avatar username username username'
            'avatar threshold threshold controls';
          grid-gap: 10px;
          background-color: #444;
          padding: 10px;
          margin: 10px;
          border-radius: 60px 60px 60px 60px;
        }
        .grid-container > * {
          background-color: rgba(255, 255, 255, 0.8);
          text-align: center;
          padding: 20px 0;
          font-size: 30px;
        }
        .peer img.avatar {
          border-radius: 50%;
          grid-area: avatar;
        }
        .peer .username {
          grid-area: username;
        }
        .peer .threshold {
          grid-area: threshold;
        }
        .peer .controls {
          grid-area: controls;
        }
      `}</style>
    </div>
  )
}
export default PeerControl
