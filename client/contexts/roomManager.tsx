import React, { FunctionComponent, useEffect, useRef, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import LoginControl from '../components/loginControl'
import RoomControl from '../components/roomControl'
import { useRtcConnections } from './rtcConnectionManager'
import { roomPeerSelect, roomState, userSelect } from '../data/atoms'
import { useStreamContext } from './streamManager'
import { Room, RoomPeer } from '../data/types'
import { useSessionContext } from './sessionManager'
import { useRouter } from 'next/router'

type RoomManagerContext = {
  joinCall: () => void
  leaveCall: () => void
}

const RoomContext = React.createContext<RoomManagerContext>({
  joinCall: () => {},
  leaveCall: () => {},
})

export const useRoomContext = () => React.useContext(RoomContext)

type RoomManagerProps = {
  roomId: string
}

export const RoomManager: FunctionComponent<RoomManagerProps> = ({ roomId }) => {
  const router = useRouter()
  const { socket } = useSessionContext()
  const user = useRecoilValue(userSelect)
  const [room, setRoom] = useRecoilState(roomState)
  const roomPeer = useRecoilValue(roomPeerSelect(user?.id))
  const roomS = useRef<Room | null>(room)
  const roomPeerS = useRef<RoomPeer | null>(roomPeer)
  const { streamMic, removeStream } = useStreamContext()
  const rtc = useRtcConnections()

  const onJoinedRoom = (user: RoomPeer, peers: RoomPeer[]) => {
    console.log(`you joined these peers in ${user.room!.id}:`)
    console.log(peers.map(p => p.id).toString())
    let order = 0
    user.order = order++
    peers.forEach(p => {
      p.order = order++
    })
    setRoom({ ...user.room!, peers: [user, ...peers] })
  }

  const onJoinRoomFailure = () => {
    console.log(`room does not exist`)
    router.push('/')
  }

  const onPeerJoinedRoom = (peer: RoomPeer) => {
    console.log(`peer ${peer.name} joined the room`)
    if (roomS.current) {
      const peers = roomS.current.peers
      if (!peers.some(p => p.id === peer.id)) {
        const orderedPeers = [...peers].sort(p => p.order)
        peer.order = orderedPeers[orderedPeers.length - 1].order + 1
        const peerUpdate = [...orderedPeers, peer]
        setRoom({ ...roomS.current, peers: peerUpdate })
      }
    }
  }

  const onPeerLeftRoom = (peer: RoomPeer) => {
    console.log(`peer ${peer.name} left the room`)
    rtc.removeConnection(peer.id)
    if (roomS.current) {
      const peerUpdate = [...roomS.current.peers].filter(p => p.id !== peer.id)
      setRoom({ ...roomS.current, peers: peerUpdate })
    }
  }

  const setInCall = (id: string, inCall: boolean) => {
    if (roomS.current) {
      const peer = roomS.current.peers.find(p => p.id === id)
      if (peer) {
        const update: RoomPeer = { ...peer, inCall: inCall }
        const peersUpdate = [update, ...roomS.current.peers.filter(p => p.id !== id)]
        setRoom({ ...roomS.current!, peers: peersUpdate })
      }
    }
  }

  const initConnection = (peer: RoomPeer) => {
    const peerConnection = rtc.addConnection(peer.id, sendIceCandidate)?.conn
    return peerConnection
  }

  const onPeerJoiningCall = async (peer: RoomPeer) => {
    if (!socket) return
    console.log(`${peer.name} is joining the call`)

    // if current user is in call too, then start up connection workflow
    if (roomPeerS.current?.inCall) {
      const peerConnection = initConnection(peer)

      if (peerConnection) {
        // send the new peer an offer to connect
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        socket.emit('offer', peer.id, offer)
      }
    }

    // need to highlight that the peer is in call in UI
    setInCall(peer.id, true)
  }

  const onPeerLeftCall = (peer: RoomPeer) => {
    console.log(`peer ${peer.name} left the call`)
    rtc.removeConnection(peer.id)
    setInCall(peer.id, false)
  }

  const onPeerChangedName = (peerId: string, userName: string) => {
    if (roomS.current) {
      const peer = roomS.current.peers.find(p => p.id === peerId)
      if (peer) {
        const update: RoomPeer = { ...peer, name: userName }
        const peersUpdate = [update, ...roomS.current.peers.filter(p => p.id !== peerId)]
        setRoom({ ...roomS.current, peers: peersUpdate })
      }
    }
  }

  const onOffer = async (peer: RoomPeer, offer: RTCSessionDescriptionInit) => {
    if (!socket) return
    console.log(`offer received from ${peer.id}`)
    const peerConnection = initConnection(peer)
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      socket.emit('answer', peer.id, answer)
    }
  }

  const onAnswer = async (peer: RoomPeer, answer: RTCSessionDescriptionInit) => {
    console.log(`answer received from ${peer.id}`)
    const peerConnection = rtc.getConnection(peer.id)?.conn
    if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  const sendIceCandidate = (id: string, c: RTCIceCandidate) => {
    console.log(`send ice candidate to ${id}`)
    socket?.emit('candidate', id, c)
  }

  const onCandidate = (id: string, candidate: RTCIceCandidate) => {
    console.log(`received candidate from ${id}`)
    rtc.addIceCandidate(id, candidate)
  }

  const joinCall = async () => {
    if (user && roomS.current && socket) {
      console.log('you are joining the call')
      await streamMic(user.id)
      socket?.emit('join-call', roomS.current.name)
      setInCall(user.id, true)
    }
  }

  const leaveCall = () => {
    if (user && roomS.current && socket) {
      console.log('you are leaving the call')
      rtc.destroy()
      removeStream(user.id)
      socket.emit('leave-call', roomS.current.name)
      setInCall(user.id, false)
    }
  }

  const unbindSocket = () => {
    if (!socket) return
    socket.off('joined-room')
    socket.off('join-room-failed')
    socket.off('peer-joining-call')
    socket.off('offer')
    socket.off('answer')
    socket.off('candidate')
    socket.off('peer-joined-room')
    socket.off('peer-left-room')
    socket.off('peer-left-call')
    socket.off('peer-changed-name')
  }

  const bindSocket = () => {
    if (!socket) return
    socket.on('joined-room', onJoinedRoom)
    socket.on('join-room-failed', onJoinRoomFailure)
    socket.on('peer-joining-call', onPeerJoiningCall)
    socket.on('offer', onOffer)
    socket.on('answer', onAnswer)
    socket.on('candidate', onCandidate)
    socket.on('peer-joined-room', onPeerJoinedRoom)
    socket.on('peer-left-room', onPeerLeftRoom)
    socket.on('peer-left-call', onPeerLeftCall)
    socket.on('peer-changed-name', onPeerChangedName)
  }

  useEffect(() => {
    roomS.current = room
    roomPeerS.current = room && user ? room.peers.find(p => p.id === user.id) ?? null : null
  })

  useEffect(() => {
    unbindSocket()
    bindSocket()

    return () => {
      unbindSocket()
    }
  })

  useEffect(() => {
    if (roomId && user?.name && socket && !roomPeer) {
      console.log('you are attempting to join room ' + roomId)
      socket?.emit('join-room', roomId)
    }
    return () => {
      if (!roomId) {
        rtc.destroy()
      }
    }
  }, [roomId, user?.name, socket, roomPeer])

  return (
    <RoomContext.Provider
      value={{
        joinCall,
        leaveCall,
      }}
    >
      {user?.name && <RoomControl />}
      { !user?.name && <LoginControl />}
    </RoomContext.Provider>
  )
}
