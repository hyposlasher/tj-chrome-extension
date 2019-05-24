const usersUrl = chrome.runtime.getURL("images/group.svg");
const tjLocationUrl = 'https://api.tjournal.ru/v1.6';
const now = new Date();
const SECONDS_IN_WEEK = 604800;
const WAIT_BEFORE_FETCH = 350;
let mostDislikedComponent = null;
let progressNode = null;

function getUniqueUsers(comments = []) {
  return comments.reduce((acc, curr) => {
    if (!acc.some(comment => comment.author.id === curr.author.id)) {
      acc.push(curr);
    }
    return acc
  }, [])
}

function addUsersCount(entry, comments) {
  console.warn('addUsersCount')
  const uniqueUsersNumber = getUniqueUsers(comments).length;

  const uniqueUsersContainer = document.createElement('div');
  uniqueUsersContainer.className = 'comments_counter';
  uniqueUsersContainer.style = "display: flex";
  
  const uniqueUsersCount = document.createElement('div');
  uniqueUsersCount.className = 'comments_counter__count__value';
  uniqueUsersCount.innerHTML = uniqueUsersNumber;

  const uniqueUsersIcon = document.createElement('img');
  uniqueUsersIcon.src = usersUrl;
  uniqueUsersIcon.style = "height: 20px";

  uniqueUsersContainer.appendChild(uniqueUsersIcon);
  uniqueUsersContainer.appendChild(uniqueUsersCount);

  entry
    .querySelector('.entry_footer')
    .appendChild(uniqueUsersContainer);
}

async function fetchEntryComments(entryId) {
  console.warn('fetchEntryComments')
  return await fetch(`${tjLocationUrl}/entry/${entryId}/comments`)
    .then((res) => res.json())
    .then(data => data.result)
    .catch(err => console.log(err))
}

function addUniqueUsers(entries) {
  console.warn('addUniqueUsers')
  entries.forEach(async entry => {
    const contentId = entry.dataset && entry.dataset.contentId;

    if (contentId) {
      const fetchedEntry = await fetchEntryComments(contentId);
      addUsersCount(entry, fetchedEntry);
    }
  })
}

function setNewEntryChunksObserver() {
  console.warn('setNewEntryChunksObserver')
  const feedContainerNode = document.querySelector('.feed__container');
  const feedObservableConfig = { childList: true};

  function observerCallback(mutationsList) {
    mutationsList.forEach((mutation) => {
        if (mutation.type == 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(addedNode => {
            const entries = addedNode.querySelectorAll('.entry_wrapper');
            addUniqueUsers(entries);
          })
        }
    })
  };

  const observer = new MutationObserver(observerCallback);
  observer.observe(feedContainerNode, feedObservableConfig);
}

function isLessThanAWeekAgo(date) {
  return ((now/1000 - date)) < SECONDS_IN_WEEK;
};

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), ms)
  })
}

async function addWorstCommentOfTheWeek() {
  console.warn('addWorstCommentOfTheWeek')
  async function fetchEntries(offset = 0, count = 50) {
    const newEntries = await fetch(`${tjLocationUrl}/timeline/mainpage?offset=${offset}&count=${count}`)
      .then(res => res.json())
      .then(res => res.result);
    
    if (newEntries.every(entry => isLessThanAWeekAgo(entry.date))) {
      return await wait(WAIT_BEFORE_FETCH) && [...newEntries , ...await fetchEntries(offset + count, 50)]
    }
  
    const filteredEntries = newEntries.filter(entry => isLessThanAWeekAgo(entry.date));
    return [...newEntries, ...filteredEntries]
  }

  function addMostDislikedComponent() {
    const existingContainer = document.querySelector('.island--top_comment_of_the_day')
    mostDislikedComponent = existingContainer.cloneNode(true);
    const titleNode = mostDislikedComponent.querySelector('.island__header__title');
    progressNode = titleNode.cloneNode(true)
    progressNode.style = 'padding-top: 5px; font-size: 12px'
    progressNode.innerHTML = ''
    titleNode.parentNode.appendChild(progressNode)
    titleNode.innerHTML = 'Худший комментарий недели'
    titleNode.style = 'padding-bottom: 0'
    mostDislikedComponent.querySelector('.vote.vote--simple').className = 'vote vote--simple vote--sum-negative'
    existingContainer.parentNode.insertBefore(mostDislikedComponent, existingContainer.nextSibling);
  }

  function trimText(text) {
    return text.slice(0, 64) + '...'
  }

  function renderMostDislikedComponent(comment, entry) {
    console.warn('renderMostDislikedComponent')
    mostDislikedComponent.querySelector('.vote__value span').innerHTML = comment.likes.summ
    mostDislikedComponent.querySelector('.live__item__user__name span').innerHTML = comment.author.name
    mostDislikedComponent.querySelector('.live__item__content').href = `https://tjournal.ru/${entry.id}?comment=${comment.id}`
    mostDislikedComponent.querySelector('.live__item__text').innerHTML = trimText(comment.text)
    mostDislikedComponent.querySelector('.live__item__user__image').src = comment.author.avatar_url
    mostDislikedComponent.querySelector('.live__item__title span').innerHTML = entry.title
    mostDislikedComponent.querySelector('.live__item__title').href = `https://tjournal.ru/${entry.id}`
    mostDislikedComponent.querySelector('.live__item__date').innerHTML = ''
    mostDislikedComponent.querySelector('.live__item__date').href = `https://tjournal.ru/${entry.id}`
  }

  async function getAllComments(entries) {
    console.warn('getAllComments')
    let allComments = []
    let mostDislikedComment = null;
    for (let i = 0; i < entries,length; i++) {
      const comments = await wait(WAIT_BEFORE_FETCH) && await fetchEntryComments(entries[i].id);
      try {
        if (!mostDislikedComponent) {
          addMostDislikedComponent()
        }
        progressNode.innerHTML = `Проверено постов: ${i + 1}/${entries.length}`
        comments.forEach(comment => {
          if (comment.likes.summ < mostDislikedComment) {
            renderMostDislikedComponent(comment, entries[i])
            mostDislikedComment = comment.likes.summ
          }
        })
        allComments = [...allComments, ...comments]
      } catch (err) {
        console.log(err)
      }
    }
    return allComments;
  };
  
  const lastWeekEntries = await fetchEntries(0, 50);
  const lastWeekComments = await getAllComments(lastWeekEntries);
}

window.onload = () => {
  const entries = document.querySelectorAll('.entry_wrapper');
  addUniqueUsers(entries);
  setNewEntryChunksObserver();
  addWorstCommentOfTheWeek();
}