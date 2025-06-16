export function Footer() {
  return (
    <footer className="mt-12 py-8 border-t border-border bg-card/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3">
          <div className="text-sm text-secondary">
            <p className="mb-2">
              このサービスは利用者のファイルを長期間保存することはなく、処理後は自動削除します。
              利用者の個人情報に関しては収集・保存・第三者への提供の一切を行いません。
            </p>
            <p className="text-xs">
              © 2025 Gifizer.
              本サービスの利用により生じた損害について、運営者は一切の責任を負いません。
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
