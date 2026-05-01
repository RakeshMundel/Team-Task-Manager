function DialogActions({ onClose, submitLabel }) {
  return (
    <div className="dialog-actions">
      <button className="ghost" type="button" onClick={onClose}>Cancel</button>
      <button className="primary" type="submit">{submitLabel}</button>
    </div>
  );
}

export default DialogActions;
