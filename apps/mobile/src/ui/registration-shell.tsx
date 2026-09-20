import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ko } from '@/i18n/ko';

import { AppText } from './app-text';
import { Button } from './button';
import { Notice } from './notice';
import { SoilGauge } from './soil-gauge';
import { TextButton } from './text-button';
import { spacing } from './tokens';
import { useColors } from './use-colors';

export interface RegistrationShellProps {
  /** 0~1. 진행 표시는 흙 게이지가 차오르는 형태다 (SPEC 14.5) */
  progress: number;
  progressLabel: string;
  /** 이 화면의 질문 하나 */
  title: string;
  onClose: () => void;
  /** 없으면 첫 단계라 "이전"을 숨긴다 */
  onBack?: () => void;
  nextLabel: string;
  nextDisabled: boolean;
  onNext: () => void;
  /** 있으면 단계 대신 이 안내만 보여 준다 (개수 제한) */
  blockedMessage?: string;
  errorMessage?: string | null;
  children: React.ReactNode;
}

/** 등록 플로우의 공통 틀: 닫기와 진행 게이지, 한 화면 한 질문, 하단의 이전·다음 */
export function RegistrationShell({
  progress,
  progressLabel,
  title,
  onClose,
  onBack,
  nextLabel,
  nextDisabled,
  onNext,
  blockedMessage,
  errorMessage,
  children,
}: RegistrationShellProps) {
  const colors = useColors();
  // 모달이 올라오는 동안 SafeAreaView 는 하단 여백을 0 으로 재는 때가 있어 루트의 값을 직접 쓴다.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      {/* iOS 모달 시트는 화면 위에서 상단 여백만큼 내려와 있다. 그만큼 더 밀어 올려야 버튼이 키보드에 안 가린다 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.screen}>
        {/* iOS 시트 안에서는 상단 여백이 0 이고, 전체 화면으로 뜨는 Android 에서는 상태 표시줄만큼 내려온다 */}
        <SafeAreaView edges={['top']} style={styles.header}>
          <TextButton label={ko.common.close} onPress={onClose} />
          <SoilGauge
            status="moist"
            moisture={blockedMessage ? 0 : progress}
            accessibilityLabel={progressLabel}
          />
        </SafeAreaView>

        {blockedMessage ? (
          <View style={styles.content}>
            <Notice message={blockedMessage} />
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <AppText variant="titleLg" accessibilityRole="header">
                {title}
              </AppText>
              {children}
              {errorMessage ? <Notice message={errorMessage} /> : null}
            </ScrollView>

            <View
              style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              {onBack ? (
                <Button
                  label={ko.common.back}
                  variant="secondary"
                  onPress={onBack}
                  style={styles.fill}
                />
              ) : null}
              <Button
                label={nextLabel}
                disabled={nextDisabled}
                onPress={onNext}
                style={styles.fill}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  fill: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
