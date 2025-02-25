import React, { useState, useReducer, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChoiceGroup, IChoiceGroupOption } from 'office-ui-fabric-react'
import { getSUDTTokenInfo } from 'services/remote'
import TextField from 'widgets/TextField'
import Button from 'widgets/Button'
import {
  validateTokenId,
  isSuccessResponse,
  useSUDTAccountInfoErrors,
  useFetchTokenInfoList,
  useOpenSUDTTokenUrl,
} from 'utils'
import { DEFAULT_SUDT_FIELDS } from 'utils/const'
import styles from './sUDTCreateDialog.module.scss'

export enum AccountType {
  SUDT = 'sudt',
  CKB = 'ckb',
}

export interface BasicInfo {
  accountName: string
}

export interface TokenInfo extends BasicInfo {
  tokenId: string
  tokenName: string
  symbol: string
  decimal: string
}

export interface SUDTCreateDialogProps extends TokenInfo {
  isMainnet: boolean
  onSubmit: (info: TokenInfo) => Promise<boolean>
  onCancel: () => void
  existingAccountNames?: string[]
  insufficient?: { [AccountType.CKB]: boolean; [AccountType.SUDT]: boolean }
}

enum DialogSection {
  Account,
  Token,
}

const accountTypes: { key: AccountType; label: string }[] = [
  {
    key: AccountType.SUDT,
    label: 's-udt.create-dialog.sudt-account',
  },
  {
    key: AccountType.CKB,
    label: 's-udt.create-dialog.ckb-account',
  },
]

const fields: { key: keyof TokenInfo; label: string }[] = [
  { key: 'accountName', label: 'account-name' },
  { key: 'tokenId', label: 'token-id' },
  { key: 'tokenName', label: 'token-name' },
  { key: 'symbol', label: 'symbol' },
  { key: 'decimal', label: 'decimal' },
]

// TODO: reuse in update dialog
const reducer: React.Reducer<
  TokenInfo,
  | { type: keyof TokenInfo | 'isCKB' | 'resetToken'; payload?: string }
  | { type: 'import'; payload: Omit<TokenInfo, 'accountName'> }
> = (state, action) => {
  switch (action.type) {
    case 'tokenId': {
      return { ...state, tokenId: (action.payload ?? state.tokenId).trim().toLowerCase() }
    }
    case 'accountName': {
      return { ...state, accountName: action.payload ?? state.accountName }
    }
    case 'tokenName': {
      return { ...state, tokenName: action.payload ?? state.tokenName }
    }
    case 'symbol': {
      return { ...state, symbol: (action.payload ?? state.symbol).trim() }
    }
    case 'decimal': {
      if (!Number.isNaN(+action.payload!)) {
        return { ...state, decimal: (action.payload ?? state.decimal).trim() }
      }
      return state
    }
    case 'isCKB': {
      return {
        accountName: state.accountName,
        tokenId: DEFAULT_SUDT_FIELDS.CKBTokenId,
        tokenName: DEFAULT_SUDT_FIELDS.CKBTokenName,
        symbol: DEFAULT_SUDT_FIELDS.CKBSymbol,
        decimal: DEFAULT_SUDT_FIELDS.CKBDecimal,
      }
    }
    case 'import': {
      return {
        ...state,
        ...action.payload,
      }
    }
    case 'resetToken': {
      return { accountName: state.accountName, tokenId: '', tokenName: '', symbol: '', decimal: '' }
    }
    default: {
      return state
    }
  }
}

const SUDTCreateDialog = ({
  accountName = '',
  tokenName = '',
  symbol = '',
  decimal = '',
  tokenId = '',
  onSubmit,
  onCancel,
  existingAccountNames = [],
  insufficient = { [AccountType.CKB]: false, [AccountType.SUDT]: false },
  isMainnet,
}: Partial<Omit<SUDTCreateDialogProps, 'onSubmit' | 'onCancel'>> &
  Pick<SUDTCreateDialogProps, 'onSubmit' | 'onCancel' | 'insufficient'>) => {
  const [t] = useTranslation()
  const [info, dispatch] = useReducer(reducer, { accountName, tokenId, tokenName, symbol, decimal })
  const [accountType, setAccountType] = useState([AccountType.SUDT, AccountType.CKB].find(at => !insufficient[at]))
  const [step, setStep] = useState(DialogSection.Account)
  const tokenInfoList = useFetchTokenInfoList()

  const tokenInfoFields: (keyof TokenInfo)[] = ['tokenId', 'tokenName', 'symbol', 'decimal']

  const tokenErrors = useSUDTAccountInfoErrors({
    info,
    isCKB: AccountType.CKB === accountType,
    existingAccountNames,
    t,
  })
  const isAccountNameReady = info.accountName.trim() && !tokenErrors.accountName && accountType

  const isTokenReady =
    isAccountNameReady && Object.values(info).every(v => v.trim()) && Object.values(tokenErrors).every(e => !e)

  const onInput = useCallback(
    (e: any) => {
      const {
        value: payload,
        dataset: { field: type },
      } = e.target

      const isTokenIdValidated = () => {
        try {
          return validateTokenId({ isCKB: false, required: true, tokenId: payload })
        } catch (_) {
          return false
        }
      }

      if (type === 'tokenId' && isTokenIdValidated()) {
        getSUDTTokenInfo({ tokenID: payload }).then(res => {
          if (isSuccessResponse(res) && res.result) {
            dispatch({ type: 'import', payload: { ...res.result, tokenId: res.result.tokenID } })
          } else {
            dispatch({ type, payload })
          }
        })
      } else {
        dispatch({ type, payload })
      }
    },
    /* eslint-disable */
    [dispatch, tokenInfoList]
  )

  const onAccountTypeSelect = useCallback(
    (_: any, option?: IChoiceGroupOption) => {
      if (option) {
        setAccountType(option.key as AccountType)
      }
    },
    [setAccountType]
  )

  const onNext = (e: React.BaseSyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
    switch (step) {
      case DialogSection.Account: {
        if (isAccountNameReady) {
          if (accountType === AccountType.CKB) {
            dispatch({ type: 'isCKB' })
          }
          setStep(s => s + 1)
        }
        break
      }
      case DialogSection.Token: {
        if (isTokenReady) {
          onSubmit({ ...info, accountName: info.accountName.trim(), tokenName: info.tokenName.trim() })
        }
        break
      }
      default: {
        // ignore
      }
    }
  }

  const onBack = () => {
    switch (step) {
      case DialogSection.Account: {
        onCancel()
        break
      }
      case DialogSection.Token: {
        dispatch({ type: 'resetToken' })
        setStep(s => s - 1)
        break
      }
      default: {
        // ignore
      }
    }
  }
  const openSUDTTokenUrl = useOpenSUDTTokenUrl(info.tokenId, isMainnet)
  return (
    <div className={styles.container}>
      {step === 0 ? (
        <div className={styles.dialogContainer}>
          <div className={styles.title}>{t('s-udt.create-dialog.create-asset-account')}</div>
          <form onSubmit={onNext}>
            {fields
              .filter(field => !tokenInfoFields.includes(field.key))
              .map(field => (
                <TextField
                  key={field.key}
                  label={t(`s-udt.create-dialog.${field.label}`)}
                  onChange={onInput}
                  field={field.key}
                  value={info[field.key]}
                  required
                  error={tokenErrors.accountName}
                  autoFocus
                />
              ))}
            <ChoiceGroup
              className={styles.accountTypes}
              options={accountTypes.map(accType => ({
                key: accType.key,
                text: t(accType.label),
                checked: accountType === accType.key,
                disabled: insufficient[accType.key],
                onRenderLabel: props => {
                  return (
                    <span className="ms-ChoiceFieldLabel">
                      <div>{props?.text}</div>
                      <span className={styles.capacityRequired} data-insufficient={insufficient[accType.key]}>
                        {t(
                          `s-udt.create-dialog.${AccountType.CKB === accType.key ? 'occupy-61-ckb' : 'occupy-142-ckb'}`
                        )}
                      </span>
                    </span>
                  )
                },
              }))}
              onChange={onAccountTypeSelect}
            />
            <div className={styles.footer}>
              <Button type="cancel" label={t('s-udt.create-dialog.cancel')} onClick={onBack} />
              <Button
                type="submit"
                label={t('s-udt.create-dialog.next')}
                onClick={onNext}
                disabled={!isAccountNameReady}
              />
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.dialogContainer}>
          <div className={styles.title}>{t('s-udt.create-dialog.set-token-info')}</div>
          <form onSubmit={onNext}>
            {fields
              .filter(field => tokenInfoFields.includes(field.key))
              .map((field, idx) => (
                <TextField
                  key={field.key}
                  label={t(`s-udt.create-dialog.${field.label}`)}
                  onChange={onInput}
                  field={field.key}
                  value={info[field.key]}
                  required={accountType === AccountType.SUDT}
                  autoFocus={!idx}
                  disabled={accountType === AccountType.CKB}
                  error={tokenErrors[field.key]}
                  className={accountType === AccountType.CKB ? styles.ckbField : undefined}
                  hint={
                    !tokenErrors[field.key] && field.key === 'tokenId' && accountType === AccountType.SUDT
                      ? t(`s-udt.create-dialog.placeholder.${field.label}`)
                      : undefined
                  }
                />
              ))}
            {accountType === AccountType.SUDT && !tokenErrors.tokenId && info.tokenId && (
              <button
                type="button"
                className={styles.explorerNavButton}
                title={t('history.view-in-explorer-button-title')}
                onClick={openSUDTTokenUrl}
              >
                {t('history.view-in-explorer-button-title')}
              </button>
            )}
            <div className={styles.footer}>
              <Button type="cancel" label={t('s-udt.create-dialog.back')} onClick={onBack} />
              <Button
                type="submit"
                label={t('s-udt.create-dialog.confirm')}
                onClick={onNext}
                disabled={!isTokenReady}
              />
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

SUDTCreateDialog.displayName = 'SUDTCreateDialog'

export default SUDTCreateDialog
