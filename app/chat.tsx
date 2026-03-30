import React, { useState, useRef, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';

type Message = {
  id: string;
  sender: 'user' | 'system';
  text: string;
};

export default function Chat() {
  const router = useRouter();
  const { spaceName, files } = useLocalSearchParams<{
    spaceName: string;
    files?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const parsedFiles: string[] = files ? JSON.parse(files) : [];

  const initialMessages: Message[] = [];

  if (parsedFiles.length > 0) {
    initialMessages.push({
      id: '1',
      sender: 'system',
      text: `✨ Space "${spaceName || 'Unknown'}" is ready!\n\n📎 ${parsedFiles.length} file(s) loaded:\n${parsedFiles.map((f) => `  • ${f}`).join('\n')}\n\nYou can now ask questions about your documents.`,
    });
  } else {
    initialMessages.push({
      id: '1',
      sender: 'system',
      text: `✨ Space "${spaceName || 'Unknown'}" is ready!\n\nNo files were added. You can still use this space for general conversation.`,
    });
  }

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'system',
          text: 'I\'m analyzing your documents to find relevant information. This is a demo response — backend integration coming soon! 🚀',
        },
      ]);
    }, 1200);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {spaceName || 'Space Name'}
          </Text>
          <View style={styles.headerMeta}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>
              {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} loaded
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.logoContainer}>
            <View style={styles.logoDot} />
            <View style={[styles.logoDot, { backgroundColor: T.colors.accentLight }]} />
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.sender === 'user'
                ? styles.userBubble
                : styles.systemBubble,
            ]}
          >
            {msg.sender === 'system' && (
              <View style={styles.senderBadge}>
                <Text style={styles.senderBadgeText}>HIVE</Text>
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                msg.sender === 'user' && styles.userMessageText,
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputBar}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Ask something about your files..."
            placeholderTextColor={T.colors.mutedText}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            activeOpacity={0.7}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.colors.background,
  },
  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingTop: 56,
    paddingBottom: T.spacing.md,
    backgroundColor: T.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: T.spacing.md,
  },
  backIcon: {
    color: T.colors.accentLight,
    fontSize: 18,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.colors.primaryText,
    textTransform: 'capitalize',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.success,
  },
  headerSub: {
    fontSize: 12,
    color: T.colors.mutedText,
  },
  headerRight: {
    marginLeft: T.spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.accent,
  },
  // ─── Chat ───
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: T.spacing.lg,
    paddingBottom: T.spacing.md,
  },
  messageBubble: {
    maxWidth: '88%',
    marginBottom: T.spacing.md,
    padding: T.spacing.md,
    borderRadius: T.radius.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: T.colors.accent,
    borderBottomRightRadius: T.radius.xs || 4,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    backgroundColor: T.colors.card,
    borderWidth: 1,
    borderColor: T.colors.border,
    borderBottomLeftRadius: T.radius.xs || 4,
  },
  senderBadge: {
    backgroundColor: T.colors.accentSoft,
    alignSelf: 'flex-start',
    borderRadius: T.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: T.spacing.sm,
  },
  senderBadgeText: {
    color: T.colors.accentLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  messageText: {
    fontSize: 15,
    color: T.colors.bodyText,
    lineHeight: 23,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  // ─── Input ───
  inputBar: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: T.colors.border,
    backgroundColor: T.colors.card,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.colors.cardElevated,
    borderRadius: T.radius.full,
    borderWidth: 1,
    borderColor: T.colors.border,
    paddingLeft: T.spacing.md,
    paddingRight: 5,
  },
  input: {
    flex: 1,
    color: T.colors.primaryText,
    fontSize: 15,
    paddingVertical: 14,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: T.colors.border,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
