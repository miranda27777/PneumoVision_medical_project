const styles = {
  page: {
    background: 'radial-gradient(100% 100% at 50% 0%, #2b1354 0%, #171136 50%, #0d0a20 100%)',
    minHeight: '100vh',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  header: {
    padding: '40px 60px',
  },

  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  logoText: {
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },

  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-120px',
  },

  stage: {
    display: 'flex',
    gap: '30px',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '40px',
  },

  card: {
    width: '240px',
    height: '300px',
    backgroundColor: '#131126',
    border: '1px solid',
    borderRadius: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    position: 'relative',
    overflow: 'visible',
  },

  xrayWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mouseCursor: {
    position: 'absolute',
    zIndex: 50,
    bottom: '30px',
    right: '30px',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.8))',
  },

  bottomSection: {
    textAlign: 'center',
  },

  mainTitle: {
    fontSize: '56px',
    fontWeight: 'bold',
    marginBottom: '24px',
    background: 'linear-gradient(to right, #fff, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: '1.25',
    letterSpacing: '-1.5px',
  },

  subTitle: {
    fontSize: '16px',
    color: '#94a3b8',
    marginBottom: '40px',
    lineHeight: '1.6',
    fontWeight: '400',
  },

  authBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
  },

  inputBox: {
    display: 'flex',
    width: '420px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },

  input: {
    flex: 1,
    border: 'none',
    padding: '18px 24px',
    outline: 'none',
    fontSize: '15px',
    color: '#fff',
    background: 'transparent',
  },

  loginBtn: {
    backgroundColor: '#116329',
    color: '#fff',
    border: 'none',
    padding: '0 30px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  regBtn: {
    backgroundColor: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '18px 35px',
    borderRadius: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  
};

export default styles;