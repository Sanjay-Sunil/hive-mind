import React, { useState, useRef, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
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
  getChunksForSpace,
} from '../src/database/database';
import SearchEngine from '../src/engine/SearchEngine';

// ─── Types ───────────────────────────────────────────────

type Message = {
  id: number | string;
  role: 'user' | 'bot';
  content: string;
};

type Chunk = {
  id: number;
  text_content: string;
  file_name: string;
};

// ─── Tab indicator ───────────────────────────────────────

type Tab = 'chat' | 'debug';

// ─── Screen ──────────────────────────────────────────────

export default function Chat() {
  const router = useRouter();
  const { spaceId, spaceName, files } = useLocalSearchParams<{
    spaceId?: string;
    spaceName: string;
    files?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const numericSpaceId = spaceId ? Number(spaceId) : null;

  // ── Chat state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  // ── Debug / chunk inspector state ──
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [debugQuery, setDebugQuery] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [debugResults, setDebugResults] = useState<any[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // ── Load chat history + warm up SearchEngine cache on mount ──
  useEffect(() => {
    (async () => {
      try {
        if (!numericSpaceId) {
          setLoading(false);
          return;
        }

        const docs = await getDocuments(numericSpaceId);
        setDocCount(docs.length);

        const dbMessages = (await getMessages(numericSpaceId)) as any[];

        if (dbMessages.length > 0) {
          setMessages(
            dbMessages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'bot',
              content: m.content,
            }))
          );
        } else {
          const parsedFiles: string[] = files ? JSON.parse(files) : [];
          const fileNames =
            parsedFiles.length > 0 ? parsedFiles : docs.map((d: any) => d.file_name);

          const welcomeText =
            fileNames.length > 0
              ? `✨ Space "${spaceName || 'Unknown'}" is ready!\n\n📎 ${fileNames.length} file(s) loaded:\n${fileNames
                  .map((f: string) => `  • ${f}`)
                  .join('\n')}\n\nYou can now ask questions about your documents.`
              : `✨ Space "${spaceName || 'Unknown'}" is ready!\n\nNo files were added. You can still use this space for general conversation.`;

          const msgId = await saveMessage(numericSpaceId, 'bot', welcomeText);
          setMessages([{ id: msgId, role: 'bot', content: welcomeText }]);
        }

        // Warm up the SearchEngine vector cache in background
        try {
          const count = await SearchEngine.loadCache(numericSpaceId);
          setCacheSize(count);
          setCacheReady(true);
        } catch (cacheErr) {
          console.warn('[Chat] SearchEngine cache failed:', cacheErr);
        }
      } catch (e) {
        console.error('Failed to load chat:', e);
      } finally {
        setLoading(false);
      }
    })();

    // Cleanup cache when leaving the space
    return () => { SearchEngine.clearCache(); };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // ── Send chat message → run hybrid search ──
  const handleSend = async () => {
    if (!inputText.trim() || !numericSpaceId) return;

    const text = inputText.trim();
    setInputText('');
    setSearching(true);

    try {
      // 1. Save & display user message
      const userMsgId = await saveMessage(numericSpaceId, 'user', text);
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }]);

      // 2. Run hybrid search (worklet vector + SQLite keyword)
      const results = await SearchEngine.search(text, numericSpaceId);

      // 3. Format results as bot response
      let botText: string;
      if (results.length === 0) {
        botText = `🔍 No relevant passages found for "${text}".\n\nTry rephrasing your query or using different keywords.`;
      } else {
        const header = `🔍 Found ${results.length} relevant passage${results.length !== 1 ? 's' : ''}:\n`;
        const body = results.slice(0, 8).map((r: any, i: number) => {
          const tag = r.source === 'keyword' ? '📌 Keyword' : `🧠 ${r.score.toFixed(2)}`;
          const preview = r.text.length > 220 ? r.text.substring(0, 220) + '…' : r.text;
          return `${i + 1}. [${tag}]  ${r.fileName}\n"${preview}"`;
        }).join('\n\n');
        botText = header + '\n' + body;
      }

      // 4. Save & display bot response
      const botMsgId = await saveMessage(numericSpaceId, 'bot', botText);
      setMessages((prev) => [...prev, { id: botMsgId, role: 'bot', content: botText }]);
    } catch (e: any) {
      console.error('Search failed:', e);
      const errMsgId = await saveMessage(numericSpaceId, 'bot', `⚠️ Search error: ${e.message}`);
      setMessages((prev) => [...prev, { id: errMsgId, role: 'bot', content: `⚠️ Search error: ${e.message}` }]);
    } finally {
      setSearching(false);
    }
  };

  // ── Debug: hybrid search OR raw chunk dump ──
  const handleTestSearch = async () => {
    if (!numericSpaceId) return;
    setChunksLoading(true);
    setDebugResults([]);
    try {
      if (debugQuery.trim().length > 0) {
        // Run the real hybrid search and display scored results
        const results = await SearchEngine.search(debugQuery.trim(), numericSpaceId);
        setDebugResults(results);
        setChunks([]);
      } else {
        // No query — fall back to raw chunk inspector
        const rows = (await getChunksForSpace(numericSpaceId)) as Chunk[];
        setChunks(rows);
        setDebugResults([]);
      }
    } catch (e) {
      console.error('Debug search failed:', e);
    } finally {
      setChunksLoading(false);
    }
  };

  // ─── Header ───────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {spaceName || 'Space Name'}
        </Text>
        <View style={styles.headerMeta}>
          <View style={[styles.onlineDot, cacheReady ? {} : { backgroundColor: T.colors.blue }]} />
          <Text style={styles.headerSub}>
            {cacheReady ? `${cacheSize} chunks cached` : 'Loading vectors…'}
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
  );

  // ─── Tab Bar ──────────────────────────────────────────

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
        onPress={() => setActiveTab('chat')}
      >
        <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
          💬 Chat
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'debug' && styles.tabActive]}
        onPress={() => setActiveTab('debug')}
      >
        <Text style={[styles.tabText, activeTab === 'debug' && styles.tabTextActive]}>
          🔬 Chunk Inspector
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Chat Tab ─────────────────────────────────────────

  const renderChatTab = () => (
    <>
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
                msg.role === 'user' ? styles.userBubble : styles.systemBubble,
              ]}
            >
              {msg.role === 'bot' && (
                <View style={styles.senderBadge}>
                  <Text style={styles.senderBadgeText}>HIVE</Text>
                </View>
              )}
              <Text
                style={[styles.messageText, msg.role === 'user' && styles.userMessageText]}
              >
                {msg.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Searching indicator */}
      {searching && (
        <View style={styles.searchingBar}>
          <ActivityIndicator size="small" color={T.colors.accentLight} />
          <Text style={styles.searchingText}>Searching knowledge base…</Text>
        </View>
      )}

      {/* Chat input */}
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
            editable={!searching}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || searching) && styles.sendButtonDisabled]}
            activeOpacity={0.7}
            onPress={handleSend}
            disabled={!inputText.trim() || searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // ─── Debug Tab ────────────────────────────────────────

  const renderChunkCard = ({ item, index }: { item: Chunk; index: number }) => (
    <View style={styles.chunkCard}>
      <View style={styles.chunkHeader}>
        <View style={styles.chunkBadge}>
          <Text style={styles.chunkBadgeText}>#{index + 1}</Text>
        </View>
        <Text style={styles.chunkFileName} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.chunkWordCount}>
          {item.text_content.split(' ').length}w
        </Text>
      </View>
      <Text style={styles.chunkText}>{item.text_content}</Text>
      {/* Overlap hint: first ~30 words are shared with previous chunk */}
      {index > 0 && (
        <View style={styles.overlapBar}>
          <Text style={styles.overlapLabel}>⟵ 30-word overlap with previous chunk</Text>
        </View>
      )}
    </View>
  );

  const renderDebugTab = () => (
    <View style={styles.debugContainer}>
      {/* Search row */}
      <View style={styles.debugSearchRow}>
        <TextInput
          style={styles.debugInput}
          placeholder="Type a query to test hybrid search…"
          placeholderTextColor={T.colors.mutedText}
          value={debugQuery}
          onChangeText={setDebugQuery}
          onSubmitEditing={handleTestSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.testSearchBtn}
          onPress={handleTestSearch}
          activeOpacity={0.8}
        >
          {chunksLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.testSearchText}>
              {debugQuery.trim() ? 'Search' : 'Dump'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={styles.debugHint}>
        {debugQuery.trim()
          ? '🔀 Hybrid search: semantic + keyword, ranked by score'
          : '📦 Leave blank to dump all raw chunks'}
      </Text>

      {/* Scored search results */}
      {debugResults.length > 0 && (
        <>
          <View style={styles.debugStats}>
            <Text style={styles.debugStatsText}>
              ✅ {debugResults.length} result{debugResults.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <FlatList
            data={debugResults}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chunkList}
            renderItem={({ item, index }) => (
              <View style={styles.chunkCard}>
                <View style={styles.chunkHeader}>
                  <View style={[
                    styles.chunkBadge,
                    item.source === 'keyword'
                      ? { backgroundColor: 'rgba(59,130,246,0.15)' }
                      : {},
                  ]}>
                    <Text style={[
                      styles.chunkBadgeText,
                      item.source === 'keyword' ? { color: T.colors.blue } : {},
                    ]}>
                      {item.source === 'keyword' ? '📌' : '🧠'} #{index + 1}
                    </Text>
                  </View>
                  <Text style={styles.chunkFileName} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={[
                    styles.chunkWordCount,
                    item.source === 'keyword'
                      ? { color: T.colors.blue, backgroundColor: T.colors.blueSoft }
                      : {},
                  ]}>
                    {item.source === 'keyword' ? 'exact' : item.score.toFixed(3)}
                  </Text>
                </View>
                <Text style={styles.chunkText}>{item.text}</Text>
              </View>
            )}
          />
        </>
      )}

      {/* Raw chunk dump (no query) */}
      {chunks.length > 0 && debugResults.length === 0 && (
        <>
          <View style={styles.debugStats}>
            <Text style={styles.debugStatsText}>
              📦 {chunks.length} chunk{chunks.length !== 1 ? 's' : ''} in this space
            </Text>
          </View>
          <FlatList
            data={chunks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderChunkCard}
            contentContainerStyle={styles.chunkList}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Loading */}
      {chunksLoading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={T.colors.accent} />
          <Text style={styles.loadingText}>
            {debugQuery.trim() ? 'Running hybrid search…' : 'Fetching chunks…'}
          </Text>
        </View>
      )}

      {/* Empty */}
      {!chunksLoading && chunks.length === 0 && debugResults.length === 0 && (
        <View style={styles.debugEmptyState}>
          <Text style={styles.debugEmptyIcon}>🗃️</Text>
          <Text style={styles.debugEmptyTitle}>Nothing to show</Text>
          <Text style={styles.debugEmptyHint}>
            Type a query and tap Search — or leave blank and tap Dump to inspect all chunks.
          </Text>
        </View>
      )}
    </View>
  );

  // ─── Render ───────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {renderHeader()}
      {renderTabBar()}
      {activeTab === 'chat' ? renderChatTab() : renderDebugTab()}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.colors.background,
  },

  // Header
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
  headerCenter: { flex: 1 },
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
  headerSub: { fontSize: 12, color: T.colors.mutedText },
  headerRight: { marginLeft: T.spacing.md },
  logoContainer: { flexDirection: 'row', gap: 4 },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: T.radius.full,
    backgroundColor: T.colors.accent,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.border,
    paddingHorizontal: T.spacing.lg,
    paddingBottom: 0,
    gap: T.spacing.md,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: T.colors.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.colors.mutedText,
  },
  tabTextActive: {
    color: T.colors.accentLight,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.md,
  },
  loadingText: {
    color: T.colors.mutedText,
    fontSize: 14,
  },

  // ── Chat ──
  chatArea: { flex: 1 },
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
  userMessageText: { color: '#FFFFFF' },
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
  sendButtonDisabled: { backgroundColor: T.colors.border },
  sendIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },

  // ── Debug / Chunk Inspector ──
  debugContainer: {
    flex: 1,
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.lg,
  },
  debugSearchRow: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
  },
  debugHint: {
    fontSize: 12,
    color: T.colors.mutedText,
    marginBottom: T.spacing.md,
    fontStyle: 'italic',
  },
  debugInput: {
    flex: 1,
    backgroundColor: T.colors.cardElevated,
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: T.radius.md,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 12,
    color: T.colors.primaryText,
    fontSize: 14,
  },
  testSearchBtn: {
    backgroundColor: T.colors.accent,
    borderRadius: T.radius.md,
    paddingHorizontal: T.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  testSearchText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  debugStats: {
    backgroundColor: T.colors.accentSoft,
    borderRadius: T.radius.sm,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    marginBottom: T.spacing.md,
    borderWidth: 1,
    borderColor: T.colors.borderAccent,
  },
  debugStatsText: {
    color: T.colors.accentLight,
    fontSize: 13,
    fontWeight: '600',
  },
  debugEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.spacing.xl,
  },
  debugEmptyIcon: { fontSize: 48, marginBottom: T.spacing.md },
  debugEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.colors.secondaryText,
    marginBottom: T.spacing.sm,
  },
  debugEmptyHint: {
    fontSize: 14,
    color: T.colors.mutedText,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Chunk cards
  chunkList: {
    paddingBottom: T.spacing.xxl,
  },
  chunkCard: {
    backgroundColor: T.colors.card,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.border,
    padding: T.spacing.md,
    marginBottom: T.spacing.md,
  },
  chunkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.spacing.sm,
    gap: T.spacing.sm,
  },
  chunkBadge: {
    backgroundColor: T.colors.accentSoft,
    borderRadius: T.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chunkBadgeText: {
    color: T.colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
  },
  chunkFileName: {
    flex: 1,
    color: T.colors.secondaryText,
    fontSize: 12,
    fontStyle: 'italic',
  },
  chunkWordCount: {
    color: T.colors.blue,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: T.colors.blueSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: T.radius.sm,
    overflow: 'hidden',
  },
  chunkText: {
    fontSize: 13,
    color: T.colors.bodyText,
    lineHeight: 20,
  },
  overlapBar: {
    marginTop: T.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 58, 237, 0.2)',
    paddingTop: T.spacing.sm,
  },
  overlapLabel: {
    fontSize: 11,
    color: T.colors.mutedText,
    fontStyle: 'italic',
  },

  // Searching indicator
  searchingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm,
    backgroundColor: T.colors.accentSoft,
    borderTopWidth: 1,
    borderTopColor: T.colors.borderAccent,
  },
  searchingText: {
    color: T.colors.accentLight,
    fontSize: 13,
    fontWeight: '600',
  },
});
