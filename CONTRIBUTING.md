# Guia de Git da equipe (passo a passo)

São 9 pessoas mexendo no mesmo projeto. Para ninguém apagar o trabalho do outro sem querer, seguimos **uma regra só**:

> **Ninguém trabalha direto na `main`.** Cada um trabalha na sua própria *branch* e depois abre um *Pull Request* (PR) para juntar na `main`.

A `main` é a versão oficial, a que vai para o site hospedado.

---

## 0. Primeira vez (só faz uma vez)

1. Crie uma conta no [GitHub](https://github.com) e mande o seu **usuário** para o Matheus.
2. Aceite o convite que vai chegar por e-mail, ou em https://github.com/notifications.
3. Instale o [Git](https://git-scm.com/downloads) e o [VS Code](https://code.visualstudio.com/).
4. Configure seu nome no Git (abra o terminal):

```bash
git config --global user.name "Seu Nome"
```

```bash
git config --global user.email "seu-email@exemplo.com"
```

5. Baixe (clone) o projeto:

```bash
git clone https://github.com/matheussss237/fatoreal.git
```

```bash
cd fatoreal
```

> 💡 **Prefere sem terminal?** Use o [GitHub Desktop](https://desktop.github.com/), que faz tudo isso com botões. Os passos têm o mesmo nome (Fetch, Branch, Commit, Push, Pull Request).

---

## 1. Todo dia, antes de começar

Pegue as novidades que os outros já colocaram:

```bash
git checkout main
```

```bash
git pull
```

## 2. Crie a sua branch para a tarefa

Use o formato `seunome/o-que-vai-fazer`:

```bash
git checkout -b pablo/filtro-busca
```

## 3. Trabalhe e salve (commit)

Depois de mudar os arquivos:

```bash
git add .
```

```bash
git commit -m "Adiciona filtro de busca em tempo real"
```

Faça vários commits pequenos, com mensagens que expliquem **o que** foi feito.

## 4. Envie para o GitHub (push)

```bash
git push -u origin pablo/filtro-busca
```

## 5. Abra o Pull Request

1. Entre no repositório no GitHub. Vai aparecer um botão amarelo **"Compare & pull request"**.
2. Preencha o modelo (o que fez, como testar, prints).
3. Peça para **outra pessoa** do time revisar.
4. Depois de aprovado, clique em **"Merge pull request"**.

## 6. Comece a próxima tarefa

Volte para o passo 1 (`git checkout main` e `git pull`) e crie uma branch nova.

---

## 🔥 Deu conflito, e agora?

Conflito acontece quando duas pessoas mexeram **na mesma linha** do mesmo arquivo. Não é erro grave.

1. Traga a `main` atualizada para a sua branch:

```bash
git pull origin main
```

2. O VS Code vai mostrar os trechos em conflito com os botões **Accept Current / Accept Incoming / Accept Both**. Escolha o certo (na dúvida, chame quem mexeu no mesmo arquivo).
3. Salve e finalize:

```bash
git add .
```

```bash
git commit -m "Resolve conflito"
```

```bash
git push
```

## 🛡️ Regras de convivência

- **Não trabalhe direto na `main`.**
- **Avise no grupo** antes de mexer em um arquivo que é de outra área (ex.: `css/style.css` é de todos, então combine antes).
- Cada tela fica no **seu próprio arquivo** em `site/paginas/` (ex.: `login.html`, `carrinho.html`). Isso evita conflito.
- **Nunca coloque senhas** no repositório. A chave `anon` do Supabase pode ficar no código. A chave `service_role` **NUNCA** pode.
- Para apagar algo de outra pessoa, combine antes. Se for apagado sem querer, o Git guarda o histórico e dá para recuperar.
- Use **Issues** (aba "Issues" no GitHub) para registrar tarefas e bugs e marcar quem é o responsável.

## Comandos rápidos

| Quero... | Comando |
|---|---|
| Ver em qual branch estou e o que mudei | `git status` |
| Pegar novidades | `git pull` |
| Trocar de branch | `git checkout nome-da-branch` |
| Criar branch nova | `git checkout -b seunome/tarefa` |
| Desfazer mudanças não salvas de um arquivo | `git restore caminho/arquivo` |
| Ver histórico | `git log --oneline` |
