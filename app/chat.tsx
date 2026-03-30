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
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CyberTheme as T } from '../constants/CyberTheme';
import {
  getMessages,
  saveMessage,
  getDocuments,
} from '../src/database/database';

type Message = {
  id: number | string;
  role: 'user' | 'bot';
  content: string;
};

export default function Chat() {
  const router = useRouter();
  const { spaceId, spaceName, files } = useLocalSearchParams<{
    spaceId?: string;
    spaceName: string;
    files?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const numericSpaceId = spaceId ? Number(spaceId) : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState(0);

  // Load chat history + document info on mount
  useEffect(() => {
    (async () => {
      try {
        if (!numericSpaceId) {
          setLoading(false);
          return;
        }

        // Load documents for header info
        const docs = await getDocuments(numericSpaceId);
        setDocCount(docs.length);

        // Load existing messages from DB
        const dbMessages = (await getMessages(numericSpaceId)) as any[];

        if (dbMessages.length > 0) {
          // Existing conversation — restore it
          setMessages(
            dbMessages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'bot',
              content: m.content,
            }))
          );
        } else {
          // Brand-new space — generate initial system message
          const parsedFiles: string[] = files ? JSON.parse(files) : [];
          const fileNames = parsedFiles.length > 0 ? parsedFiles : docs.map((d: any) => d.file_name);

          const welcomeText =
            fileNames.length > 0
              ? `✨ Space "${spaceName || 'Unknown'}" is ready!\n\n📎 ${fileNames.length} file(s) loaded:\n${fileNames.map((f: string) => `  • ${f}`).join('\n')}\n\nYou can now ask questions about your documents.`
              : `✨ Space "${spaceName || 'Unknown'}" is ready!\n\nNo files were added. You can still use this space for general conversation.`;

          // Save the welcome message to DB
          const msgId = await saveMessage(numericSpaceId, 'bot', welcomeText);
          setMessages([{ id: msgId, role: 'bot', content: welcomeText }]);
        }
      } catch (e) {
        console.error('Failed to load chat:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !numericSpaceId) return;

    const text = inputText.trim();
    setInputText('');

    // Save user message to DB and update state
    try {
      const userMsgId = await saveMessage(numericSpaceId, 'user', text);
      const userMsg: Message = { id: userMsgId, role: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);

      // Simulate bot response + save to DB
      setTimeout(async () => {
        const botText =
          "I'm analyzing your documents to find relevant information. This is a demo response — backend integration coming soon! 🚀";
        const botMsgId = await saveMessage(numericSpaceId, 'bot', botText);
        setMessages((prev) => [
          ...prev,
          { id: botMsgId, role: 'bot', content: botText },
        ]);
      }, 1200);
    } catch (e) {
      console.error('Failed to send message:', e);
    }
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
              {docCount} file{docCount !== 1 ? 's' : ''} loaded
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
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={T.colors.accent} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id.toString()}
              style={[
                styles.messageBubble,
                msg.role === 'user'
                  ? styles.userBubble
                  : styles.systemBubble,
              ]}
            >
              {msg.role === 'bot' && (
                <View style={styles.senderBadge}>
                  <Text style={styles.senderBadgeText}>HIVE</Text>
                </View>
              )}
              <Text
                style={[
                  styles.messageText,
                  msg.role === 'user' && styles.userMessageText,
                ]}
              >
                {msg.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderBottomRightRadius: 4,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    backgroundColor: T.colors.card,
    borderWidth: 1,
    borderColor: T.colors.border,
    borderBottomLeftRadius: 4,
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
