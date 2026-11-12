import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, MessageCircle, Mic, MicOff } from 'lucide-react';
import {
  assessmentDefinitions,
  getConversation,
  createConversation,
  confirmAnswer,
  finalizeConversation,
} from '../../../api/conversations.js';
import { LiveAudio } from './live-audio.js';

export default function AssessmentConversation({ patient, onCancel, onSaved }) {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [choice, setChoice] = useState(null);
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [consent, setConsent] = useState(false);
  const connection = useRef(null),
    audio = useRef(null),
    generation = useRef(0),
    mounted = useRef(true);
  const transcriptRef = useRef(null);
  const draftRef = useRef(null);
  function receiveState(state) {
    if (
      !draftRef.current ||
      draftRef.current.id !== state.id ||
      state.revision >= draftRef.current.revision
    ) {
      draftRef.current = state;
      setDraft(state);
    }
  }
  const storageKey = `pod-gad7-draft:${patient.id}`;
  const definition =
    draft?.definition || config?.definitions.find((d) => d.id === 'GAD7');
  const index = draft?.answers.findIndex((value) => value === null) ?? 0;
  const question = definition?.questions[index];
  const review = Boolean(draft && index === -1);
  const connected = status === 'connected';
  const answered = draft?.answers.filter((value) => value !== null).length || 0;
  function remember(id) {
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* storage may be disabled */
    }
  }
  function closeConnection() {
    generation.current += 1;
    const socket = connection.current;
    connection.current = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    audio.current?.close();
    audio.current = null;
  }
  function addTranscript(speaker, content, append = false) {
    setTranscript((previous) => {
      const last = previous.at(-1);
      if (append && last?.speaker === speaker && !last.complete)
        return [
          ...previous.slice(-79, -1),
          { ...last, text: (last.text + content).slice(-4000) },
        ];
      return [
        ...previous.slice(-79),
        { speaker, text: content, complete: !append },
      ];
    });
  }
  useEffect(() => {
    mounted.current = true;
    let live = true;
    (async () => {
      try {
        const settings = await assessmentDefinitions();
        if (live) setConfig(settings);
        let id;
        try {
          id = sessionStorage.getItem(storageKey);
        } catch {
          /* optional */
        }
        if (id) {
          try {
            const state = await getConversation(id);
            if (
              live &&
              state.patientId === patient.id &&
              state.status === 'draft'
            )
              receiveState(state);
            else if (live) remember(null);
          } catch {
            if (live)
              setError(
                'Your previous draft could not be loaded. Try reloading before starting a new conversation.',
              );
          }
        }
      } catch (err) {
        if (live) setError(err.message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      mounted.current = false;
      closeConnection();
    };
  }, [patient.id]);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [transcript]);
  useEffect(() => {
    audio.current?.mute(muted || Boolean(proposal) || busy || review || paused);
  }, [muted, proposal, busy, review, paused]);
  useEffect(() => {
    const warn = (event) => {
      if (draft?.status === 'draft') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);
  async function connect(withVoice) {
    closeConnection();
    const current = generation.current;
    setError('');
    setStatus('connecting');
    setPaused(false);
    setProposal(null);
    setChoice(null);
    setMuted(false);
    setVoice(withVoice);
    try {
      if (withVoice) {
        const device = new LiveAudio((buffer) => {
          const socket = connection.current;
          if (
            socket?.readyState === WebSocket.OPEN &&
            socket.bufferedAmount < 64000
          )
            socket.send(buffer);
        });
        audio.current = device;
        await device.start();
      }
      if (current !== generation.current) return;
      const state = draft
        ? await getConversation(draft.id)
        : await createConversation({
            id: crypto.randomUUID(),
            patientId: patient.id,
            assessmentId: 'GAD7',
          });
      if (current !== generation.current) return;
      remember(state.id);
      receiveState(state);
      if (state.status !== 'draft' || state.answers.every((a) => a !== null)) {
        closeConnection();
        setStatus('review');
        return;
      }
      const socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/conversations/${state.id}/live`,
      );
      connection.current = socket;
      socket.onmessage = (event) => {
        if (connection.current !== socket) return;
        const message = JSON.parse(event.data);
        if (message.type === 'state') {
          receiveState(message.state);
          setProposal(null);
          setChoice(null);
        }
        if (message.type === 'proposal') {
          const latest = draftRef.current;
          const q =
            latest?.definition.questions[
              latest.answers.findIndex((a) => a === null)
            ];
          if (
            message.revision === latest?.revision &&
            message.questionId === q?.id &&
            q.options.some((o) => o.value === message.value)
          ) {
            setProposal(message);
            setChoice(message.value);
          }
        }
        if (message.type === 'proposal_cleared') {
          setProposal(null);
          setChoice(null);
        }
        if (message.type === 'transcript')
          addTranscript(message.speaker, message.text, true);
        if (message.type === 'turn_complete')
          setTranscript((items) =>
            items.map((item) => ({ ...item, complete: true })),
          );
        if (message.type === 'audio') audio.current?.play(message.data);
        if (message.type === 'audio_interrupt') audio.current?.interrupt();
        if (message.type === 'paused') {
          setPaused(true);
          setError(message.message);
          audio.current?.mute(true);
        }
        if (message.type === 'error') setError(message.message);
        if (message.type === 'status') {
          setStatus(message.status);
          if (message.message) setError(message.message);
          if (['error', 'review'].includes(message.status)) {
            closeConnection();
            setVoice(false);
          }
        }
      };
      socket.onerror = () => {
        if (connection.current === socket)
          setError(
            'Cannot connect to Gemini. Check its configuration, or close another conversation for this draft.',
          );
      };
      socket.onclose = () => {
        if (connection.current !== socket) return;
        closeConnection();
        setStatus('disconnected');
        setVoice(false);
        setProposal(null);
        setChoice(null);
      };
    } catch (err) {
      if (current !== generation.current) return;
      closeConnection();
      setStatus('error');
      setVoice(false);
      setError(err.message);
    }
  }
  async function answer(questionId, value) {
    if (busy || paused) return;
    setBusy(true);
    setError('');
    audio.current?.interrupt();
    try {
      const state = await confirmAnswer(draft.id, {
        questionId,
        value,
        revision: draft.revision,
      });
      if (!mounted.current) return;
      receiveState(state);
      setProposal(null);
      setChoice(null);
      const q = state.definition.questions.find((q) => q.id === questionId);
      addTranscript(
        'confirmed',
        `${q.text}: ${q.options.find((o) => o.value === value).label}`,
      );
      if (state.answers.every((a) => a !== null)) {
        closeConnection();
        setVoice(false);
        setStatus('review');
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        try {
          receiveState(await getConversation(draft.id));
          setProposal(null);
          setChoice(null);
        } catch {
          /* retain local draft on network failure */
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function sendText(event) {
    event.preventDefault();
    if (!text.trim() || !connected || paused || proposal) return;
    connection.current.send(
      JSON.stringify({ type: 'text', text: text.trim() }),
    );
    addTranscript('you', text.trim());
    setText('');
  }
  async function save() {
    setBusy(true);
    setError('');
    closeConnection();
    try {
      const result = await finalizeConversation(draft.id, draft.revision);
      remember(null);
      await onSaved(result);
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        setBusy(false);
      }
    }
  }
  return (
    <>
      <button className="back-link" onClick={onCancel} disabled={busy}>
        <ArrowLeft size={17} /> Back to patient details
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GAD-7 · GUIDED CONVERSATION</div>
          <h1>{review ? 'Review your answers' : 'One question at a time'}</h1>
          <p>
            For {patient.name} · Think about{' '}
            {definition?.referencePeriod || 'the past two weeks'}.
          </p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading && <p role="status">Loading assessment…</p>}
      {!loading && !config?.geminiConfigured && (
        <section className="panel">
          <h2>Gemini is not configured yet</h2>
          <p>
            Add your Gemini API key to the backend environment and restart the
            API. The standard GAD-7 form remains available.
          </p>
          <button className="button outline" onClick={onCancel}>
            Back to assessments
          </button>
        </section>
      )}
      {definition && (
        <p className="clinical-note">
          This is a draft conversational screening experience. It does not
          provide a diagnosis or notify a clinician. Review every response
          before saving.
        </p>
      )}
      {!review && config?.geminiConfigured && !loading && (
        <>
          <section className="panel conversation-connection">
            <div>
              <h2>
                <MessageCircle size={20} /> Gemini conversation
              </h2>
              <p>
                Your typed responses and, when enabled, microphone audio are
                sent to Google Gemini. Your patient name and medical record are
                not included. Only confirmed answers are stored here.
              </p>
              {!connected && (
                <label className="conversation-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />{' '}
                  I agree to send my responses to Gemini for this conversation.
                </label>
              )}
            </div>
            <div className="conversation-controls">
              <span
                role="status"
                className={`connection-status ${connected ? 'connected' : ''}`}
              >
                {status === 'idle'
                  ? 'Ready to start'
                  : status === 'connecting'
                    ? 'Connecting…'
                    : connected
                      ? 'Connected'
                      : 'Disconnected'}
              </span>
              {!connected && (
                <>
                  <button
                    className="button primary"
                    disabled={
                      !consent || busy || status === 'connecting' || paused
                    }
                    onClick={() => connect(false)}
                  >
                    <MessageCircle size={17} />{' '}
                    {draft ? 'Reconnect with text' : 'Start with text'}
                  </button>
                  <button
                    className="button outline"
                    disabled={
                      !consent || busy || status === 'connecting' || paused
                    }
                    onClick={() => connect(true)}
                  >
                    <Mic size={17} />{' '}
                    {draft ? 'Reconnect with voice' : 'Start with voice'}
                  </button>
                </>
              )}
              {connected && voice && (
                <button
                  className="button outline"
                  disabled={Boolean(proposal) || busy || paused}
                  onClick={() => {
                    if (!muted)
                      connection.current?.send(
                        JSON.stringify({ type: 'audio_end' }),
                      );
                    setMuted(!muted);
                  }}
                >
                  {muted ? <MicOff size={17} /> : <Mic size={17} />}
                  {muted ? 'Unmute microphone' : 'Mute microphone'}
                </button>
              )}
              {(connected || status === 'connecting') && (
                <button
                  className="button outline"
                  onClick={() => {
                    closeConnection();
                    setStatus('disconnected');
                    setVoice(false);
                    setProposal(null);
                    setChoice(null);
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </section>
          {paused && (
            <p className="clinical-note">
              Leave this conversation to stop. Confirmed answers remain in your
              draft for review.
            </p>
          )}
        </>
      )}
      {draft && (
        <>
          <div className="conversation-progress">
            <strong>
              {answered} of {definition.questions.length} confirmed
            </strong>
            <span>Draft saved locally on this server</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Confirmed answers"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={definition.questions.length}
          >
            <div
              style={{
                width: `${(answered / definition.questions.length) * 100}%`,
              }}
            />
          </div>
          {!review && question && (
            <div className="conversation-grid">
              <section className="panel conversation-question">
                <div className="eyebrow">
                  QUESTION {index + 1} OF {definition.questions.length}
                </div>
                <h2>{question.text}</h2>
                <p>{definition.instructions}</p>
                {proposal && (
                  <div className="conversation-proposal" role="status">
                    <strong>Suggested response — please confirm</strong>
                    <p>{proposal.summary}</p>
                  </div>
                )}
                <fieldset
                  disabled={busy || paused}
                  className="conversation-options"
                >
                  <legend>Choose or confirm your response</legend>
                  {question.options.map((option) => (
                    <label
                      key={option.value}
                      className={choice === option.value ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={choice === option.value}
                        onChange={() => setChoice(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
                <button
                  className="button primary"
                  disabled={choice === null || busy || paused}
                  onClick={() => answer(question.id, choice)}
                >
                  <Check size={17} />
                  {busy ? 'Saving answer…' : 'Confirm response'}
                </button>
                <p className="clinical-note">
                  Gemini cannot save an answer for you. You can choose any
                  response above, including when disconnected.
                </p>
              </section>
              <section className="panel conversation-chat">
                <h2>Conversation</h2>
                <div
                  className="conversation-transcript"
                  ref={transcriptRef}
                  role="log"
                  aria-label="Conversation transcript"
                  aria-live="polite"
                >
                  {!transcript.length && (
                    <p className="conversation-empty">
                      Gemini will ask the question shown alongside. Type your
                      answer, or speak after starting voice mode.
                    </p>
                  )}
                  {transcript.map((entry, i) => (
                    <div
                      key={i}
                      className={`conversation-message ${entry.speaker}`}
                    >
                      <strong>
                        {entry.speaker === 'assistant'
                          ? 'Gemini'
                          : entry.speaker === 'confirmed'
                            ? 'Confirmed'
                            : 'You'}
                      </strong>
                      <p>{entry.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendText} className="conversation-composer">
                  <label htmlFor="conversation-response">Your response</label>
                  <textarea
                    id="conversation-response"
                    rows={3}
                    maxLength={1000}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    disabled={!connected || paused || Boolean(proposal)}
                    placeholder="Describe how often this happened…"
                  />
                  <button
                    className="button primary"
                    disabled={
                      !connected || paused || Boolean(proposal) || !text.trim()
                    }
                    type="submit"
                  >
                    Send response
                  </button>
                </form>
              </section>
            </div>
          )}
          {review && (
            <section className="panel conversation-review">
              <h2>Confirm all {definition.questions.length} responses</h2>
              <p>
                Change any response below before saving the assessment to{' '}
                {patient.name}’s record.
              </p>
              {definition.questions.map((q, i) => (
                <label key={q.id} className="conversation-review-row">
                  <span>
                    {i + 1}. {q.text}
                  </span>
                  <select
                    aria-label={`Review ${q.id}`}
                    value={draft.answers[i]}
                    disabled={busy}
                    onChange={(event) =>
                      answer(q.id, Number(event.target.value))
                    }
                  >
                    {q.options.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button className="button primary" onClick={save} disabled={busy}>
                <Check size={17} />
                {busy
                  ? 'Saving assessment…'
                  : 'Confirm answers and save assessment'}
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}
