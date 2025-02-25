import React, { useEffect, useRef, useState } from "react";
import "../styles/Chat.css";
import socket from "../services/socket.ts";

interface User {
  id: number;
  nickname: string;
}

interface ChatProps {
  activeChat: { id: number; name: string } | null;
  selectedUser?: User | null;
}

interface Message {
  senderId: number;
  senderNickname: string;
  recipientId?: number;
  channelId?: number;
  content: string;
}

const Chat: React.FC<ChatProps> = ({ activeChat, selectedUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const nickname = localStorage.getItem("nickname") || "Anonyme";
  const userId = Number(localStorage.getItem("userId"));

 
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
  
    if (!userId || isNaN(userId)) {
      setError("Utilisateur non connecté. Veuillez vous reconnecter.");
      return;
    }

 
    setMessages([]);


    if (activeChat) {
      socket.emit("getUsersInChannel", { channel: activeChat.name });

      socket.on("usersInChannel", ({ users }) => {
        const isAlreadyMember = users.some((user) => user.nickname === nickname);
        if (!isAlreadyMember) {
          socket.emit("joinChannel", { channelName: activeChat.name, nickname });
        }
        socket.emit("getMessages", { channelId: activeChat.id });
      });

      socket.on("messageHistory", (data: Message[]) => {
        setMessages(data);
        scrollToBottom();
      });

      socket.on("newMessage", (msg: Message) => {
        if (msg.channelId === activeChat.id) {
          setMessages((prev) => [...prev, msg]);
          scrollToBottom();
        }
      });
    }


    if (selectedUser) {
      socket.emit("getPrivateMessages", {
        senderId: userId,
        recipientId: selectedUser.id,
      });

      socket.on("privateMessageHistory", (data: Message[]) => {
        setMessages(data);
        scrollToBottom();
      });

      socket.on("privateMessage", (msg: Message) => {
        if (
          (msg.senderId === userId && msg.recipientId === selectedUser.id) ||
          (msg.senderId === selectedUser.id && msg.recipientId === userId)
        ) {
          setMessages((prev) => [...prev, msg]);
          scrollToBottom();
        }
      });
    }


    socket.on("error", (err: { message: string }) => setError(err.message));
    socket.on("connect_error", () => setError("Erreur de connexion au serveur."));
    socket.on("disconnect", () => setError("Déconnecté du serveur."));


    return () => {
      socket.off("usersInChannel");
      socket.off("messageHistory");
      socket.off("newMessage");
      socket.off("privateMessageHistory");
      socket.off("privateMessage");
      socket.off("error");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, [activeChat, selectedUser, nickname, userId]);


  const handleSendMessage = () => {
    if (!newMessage.trim()) {
      setError("Le message ne peut pas être vide.");
      return;
    }

    if (!userId || isNaN(userId)) {
      setError("Utilisateur non connecté. Veuillez vous reconnecter.");
      return;
    }

    const messagePayload: Message = {
      senderId: userId,
      senderNickname: nickname,
      content: newMessage,
      ...(activeChat ? { channelId: activeChat.id } : {}),
      ...(selectedUser ? { recipientId: selectedUser.id } : {}),
    };


    socket.emit("sendMessage", messagePayload);


    setMessages((prev) => [...prev, messagePayload]);
    setNewMessage("");
    scrollToBottom();
  };


  const chatTitle = activeChat
    ? `Channel: ${activeChat.name}`
    : selectedUser
    ? `Chat privé avec ${selectedUser.nickname}`
    : "Sélectionnez une conversation";

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>{chatTitle}</h3>
      </div>

      <div className="chat-body">
        {messages.map((msg, idx) => (
          <p
            key={idx}
            className={`message ${msg.senderNickname === nickname ? "sent" : "received"}`}
          >
            <strong>{msg.senderNickname} :</strong> {msg.content}
          </p>
        ))}
        <div ref={messageEndRef} />
      </div>

      {(activeChat || selectedUser) && (
        <div className="chat-footer">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrivez un message..."
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button onClick={handleSendMessage}>Envoyer</button>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default Chat;